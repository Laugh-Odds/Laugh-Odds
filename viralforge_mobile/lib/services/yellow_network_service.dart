import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/constants.dart';

/// Yellow Network (Nitrolite) state channel service.
/// Connects to ClearNode via WebSocket for auth, balance, and vote transfers.
class YellowNetworkService {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  bool _isAuthenticated = false;
  String _balance = '0';
  String? _channelId;
  String? _error;
  int _reqId = 1;

  final _pendingTransfers = <int, Completer<Map<String, dynamic>>>{};
  final _statusController = StreamController<void>.broadcast();

  // Public getters
  bool get isConnected => _isConnected;
  bool get isAuthenticated => _isAuthenticated;
  String get balance => _balance;
  String? get channelId => _channelId;
  String? get error => _error;
  Stream<void> get statusStream => _statusController.stream;

  int _nextReqId() => _reqId++;

  /// Build Nitrolite RPC request
  Map<String, dynamic> _buildRequest(String method, Map<String, dynamic> params) {
    return {
      'req': [_nextReqId(), method, params, DateTime.now().millisecondsSinceEpoch],
      'sig': <String>[],
    };
  }

  /// Parse Nitrolite RPC response
  Map<String, dynamic>? _parseResponse(String data) {
    try {
      final msg = jsonDecode(data);
      if (msg['res'] != null && msg['res'] is List && (msg['res'] as List).length >= 3) {
        final res = msg['res'] as List;
        return {'id': res[0], 'method': res[1], 'result': res[2]};
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Connect to ClearNode WebSocket
  Future<void> connect(String walletAddress) async {
    if (_isConnected) return;

    try {
      debugPrint('[Yellow] Connecting to ClearNode...');
      _channel = WebSocketChannel.connect(Uri.parse(clearnodeWsUrl));

      await _channel!.ready;
      _isConnected = true;
      _error = null;
      _notifyStatus();
      debugPrint('[Yellow] WebSocket connected');

      // Listen for messages
      _channel!.stream.listen(
        (data) => _handleMessage(data.toString(), walletAddress),
        onError: (err) {
          debugPrint('[Yellow] WebSocket error: $err');
          _error = 'Yellow Network connection error';
          _isConnected = false;
          _isAuthenticated = false;
          _notifyStatus();
        },
        onDone: () {
          debugPrint('[Yellow] WebSocket disconnected');
          _isConnected = false;
          _isAuthenticated = false;
          _channel = null;
          _notifyStatus();
        },
      );

      // Start auth
      _startAuth(walletAddress);
    } catch (e) {
      debugPrint('[Yellow] Connection failed: $e');
      _error = 'Failed to connect to Yellow Network';
      _isConnected = false;
      _notifyStatus();
    }
  }

  /// Start authentication flow
  void _startAuth(String walletAddress) {
    // For mobile (no MetaMask), we send auth_request
    // The server-side handles the session key approach
    // Mobile uses a simplified auth: just declare identity
    final params = {
      'address': walletAddress,
      'session_key': walletAddress, // Use wallet address as session key for mobile
      'application': 'ViralForge',
      'allowances': [
        {'asset': voteAsset, 'amount': '1000000000'}
      ],
      'expires_at': (DateTime.now().millisecondsSinceEpoch ~/ 1000) + 3600,
      'scope': 'test.app',
    };

    _sendMessage(_buildRequest('auth_request', params));
  }

  /// Handle incoming WebSocket messages
  void _handleMessage(String data, String walletAddress) {
    final parsed = _parseResponse(data);
    if (parsed == null) {
      debugPrint('[Yellow] Unparseable message: $data');
      return;
    }

    final id = parsed['id'] as int;
    final method = parsed['method'] as String;
    final result = parsed['result'];

    debugPrint('[Yellow] Received: $method');

    switch (method) {
      case 'auth_challenge':
        // For mobile without EIP-712 signing, we attempt a simplified verify
        // In production, this would need proper wallet signing
        final challenge = result?['challenge_message'] as String?;
        if (challenge != null) {
          _sendMessage({
            'req': [
              _nextReqId(),
              'auth_verify',
              {'challenge': challenge},
              DateTime.now().millisecondsSinceEpoch,
            ],
            'sig': ['0x'], // Placeholder - mobile simplified auth
          });
        }
        break;

      case 'auth_verify':
        if (result?['success'] == true ||
            result?['authenticated'] == true ||
            result?['session_key'] != null) {
          debugPrint('[Yellow] Authenticated!');
          _isAuthenticated = true;
          _error = null;
          // Fetch balance and channels
          _sendMessage(_buildRequest('get_ledger_balances', {}));
          _sendMessage(_buildRequest('get_channels', {}));
          // Request faucet
          requestFaucetTokens(walletAddress);
        } else {
          debugPrint('[Yellow] Auth failed: $result');
          _error = result?['error']?.toString() ?? 'Authentication failed';
          _isAuthenticated = false;
        }
        _notifyStatus();
        break;

      case 'get_ledger_balances':
        final entries = result?['ledger_balances'] as List? ?? [];
        for (final entry in entries) {
          if (entry['asset'] == voteAsset) {
            final amount = double.tryParse(entry['amount']?.toString() ?? '0') ?? 0;
            _balance = (amount / 1000000).toString();
          }
        }
        _notifyStatus();
        break;

      case 'bu': // Balance update push notification
        final updates = result?['balance_updates'] as List? ?? [];
        for (final entry in updates) {
          if (entry['asset'] == voteAsset) {
            final amount = double.tryParse(entry['amount']?.toString() ?? '0') ?? 0;
            _balance = (amount / 1000000).toString();
          }
        }
        if (updates.isEmpty) {
          _sendMessage(_buildRequest('get_ledger_balances', {}));
        }
        _notifyStatus();
        break;

      case 'channels':
      case 'get_channels':
        final channelList = result?['channels'] as List? ??
            (result is List ? result : []);
        for (final ch in channelList) {
          if (ch['status'] == 'open') {
            _channelId = ch['channel_id']?.toString() ?? ch['id']?.toString();
            break;
          }
        }
        _notifyStatus();
        break;

      case 'cu': // Channel update notification
        _sendMessage(_buildRequest('get_channels', {}));
        break;

      case 'tr': // Transfer notification
      case 'asu': // App session update
        break;

      case 'open_channel':
        if (result?['channel_id'] != null) {
          _channelId = result['channel_id'].toString();
          debugPrint('[Yellow] Channel opened: $_channelId');
        }
        _notifyStatus();
        break;

      case 'transfer':
        final completer = _pendingTransfers.remove(id);
        if (completer != null) {
          final txs = result?['transactions'] as List?;
          if (txs != null && txs.isNotEmpty) {
            completer.complete({
              'success': true,
              'transferId': txs[0]['id']?.toString() ?? '',
            });
            _sendMessage(_buildRequest('get_ledger_balances', {}));
          } else if (result?['error'] != null) {
            completer.complete({
              'success': false,
              'error': result['error'].toString(),
            });
          } else {
            completer.complete({
              'success': false,
              'error': 'Transfer failed - no transaction returned',
            });
          }
        }
        break;

      case 'error':
        debugPrint('[Yellow] Server error: ${result?['error']}');
        _error = result?['error']?.toString();
        _notifyStatus();
        break;

      default:
        debugPrint('[Yellow] Unhandled: $method');
    }
  }

  /// Send a vote transfer via state channel
  Future<Map<String, dynamic>> sendVoteTransfer({
    required String toAddress,
    required int marketId,
    required String vote,
  }) async {
    if (!_isAuthenticated) {
      return {'success': false, 'error': 'Not authenticated with Yellow Network'};
    }

    final reqId = _nextReqId();
    final params = {
      'allocations': [
        {'asset': voteAsset, 'amount': voteCostAmount}
      ],
      'destination': toAddress,
    };

    final req = [reqId, 'transfer', params, DateTime.now().millisecondsSinceEpoch];
    final completer = Completer<Map<String, dynamic>>();
    _pendingTransfers[reqId] = completer;

    _channel?.sink.add(jsonEncode({'req': req, 'sig': <String>[]}));

    // Timeout after 30s
    return completer.future.timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        _pendingTransfers.remove(reqId);
        return {'success': false, 'error': 'Transfer timeout'};
      },
    );
  }

  /// Refresh balance
  void refreshBalance() {
    if (_isAuthenticated) {
      _sendMessage(_buildRequest('get_ledger_balances', {}));
    }
  }

  /// Request faucet tokens from Yellow Network
  Future<bool> requestFaucetTokens(String walletAddress) async {
    try {
      final response = await http.post(
        Uri.parse(yellowFaucetUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userAddress': walletAddress}),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('[Yellow] Faucet request failed: $e');
      return false;
    }
  }

  /// Disconnect from ClearNode
  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    _isConnected = false;
    _isAuthenticated = false;
    _channelId = null;
    _balance = '0';
    _notifyStatus();
  }

  void _sendMessage(Map<String, dynamic> msg) {
    if (_channel != null && _isConnected) {
      _channel!.sink.add(jsonEncode(msg));
    }
  }

  void _notifyStatus() {
    if (!_statusController.isClosed) {
      _statusController.add(null);
    }
  }

  void dispose() {
    disconnect();
    _statusController.close();
  }
}
