import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:reown_appkit/reown_appkit.dart';
import '../providers/app_provider.dart';
import '../config/constants.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  ReownAppKitModal? _appKitModal;
  bool _isInitialized = false;
  bool _isChecking = false;
  String? _initError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initWalletConnect();
    });
  }

  Future<void> _initWalletConnect() async {
    try {
      if (!mounted) return;

      // Configure networks: Sepolia only
      ReownAppKitModalNetworks.removeSupportedNetworks('solana');
      ReownAppKitModalNetworks.removeSupportedNetworks('eip155');
      ReownAppKitModalNetworks.addSupportedNetworks('eip155', [
        ReownAppKitModalNetworkInfo(
          name: 'Sepolia',
          chainId: '11155111',
          currency: 'ETH',
          rpcUrl: sepoliaRpcUrl,
          explorerUrl: explorerUrl,
          isTestNetwork: true,
        ),
      ]);

      if (!mounted) return;

      _appKitModal = ReownAppKitModal(
        context: context,
        projectId: wcProjectId,
        metadata: const PairingMetadata(
          name: 'ViralForge',
          description: 'Web3 Meme Prediction Market',
          url: 'https://viralforge.app/',
          icons: ['https://viralforge.app/logo.png'],
          redirect: Redirect(
            native: 'viralforge://',
            universal: 'https://viralforge.app',
          ),
        ),
      );

      await _appKitModal!.init();

      if (!mounted) return;

      _appKitModal!.onModalConnect.subscribe(_onConnect);
      _appKitModal!.onModalDisconnect.subscribe(_onDisconnect);
      _appKitModal!.onModalNetworkChange.subscribe(_onNetworkChange);
      _appKitModal!.onModalUpdate.subscribe(_onModalUpdate);

      // Check if already connected from a previous session
      if (_appKitModal!.isConnected) {
        _syncAddressToProvider();
      }

      if (mounted) {
        setState(() {
          _isInitialized = true;
          _initError = null;
        });
      }
    } catch (e) {
      debugPrint('[WalletConnect] Init error: $e');
      if (mounted) {
        setState(() {
          _initError = e.toString();
          _isInitialized = true;
        });
      }
    }
  }

  void _onConnect(ModalConnect? event) {
    debugPrint('[WalletConnect] Connected! session: ${event?.session}');
    // Try getting address from the event's session first
    if (event?.session != null) {
      final addr = event!.session.getAddress('eip155');
      debugPrint('[WalletConnect] Address from event session: $addr');
      if (addr != null && addr.isNotEmpty) {
        final provider = context.read<AppProvider>();
        if (!provider.isConnected || provider.walletAddress != addr) {
          provider.connectWallet(addr);
        }
        if (mounted) setState(() {});
        return;
      }
    }
    // Fallback to modal session
    _syncAddressToProvider();
    // If still not synced, retry after a delay (chain may not be set yet)
    if (!context.read<AppProvider>().isConnected) {
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) _syncAddressToProvider();
      });
    }
    if (mounted) setState(() {});
  }

  void _onNetworkChange(ModalNetworkChange? event) {
    debugPrint('[WalletConnect] Network changed: ${event?.chainId}');
    _syncAddressToProvider();
    if (mounted) setState(() {});
  }

  void _onModalUpdate(ModalConnect? event) {
    debugPrint('[WalletConnect] Session updated');
    _syncAddressToProvider();
    if (mounted) setState(() {});
  }

  void _onDisconnect(ModalDisconnect? event) {
    debugPrint('[WalletConnect] Disconnected');
    final provider = context.read<AppProvider>();
    provider.disconnectWallet();
    if (mounted) setState(() {});
  }

  void _syncAddressToProvider() {
    final address = _getWalletAddress();
    if (address != null) {
      debugPrint('[WalletConnect] Address: $address');
      final provider = context.read<AppProvider>();
      if (!provider.isConnected || provider.walletAddress != address) {
        provider.connectWallet(address);
      }
    }
  }

  String? _getWalletAddress() {
    if (_appKitModal == null || !_appKitModal!.isConnected) return null;
    final session = _appKitModal!.session;
    if (session == null) return null;

    // Primary: get address via 'eip155' namespace directly
    try {
      final addr = session.getAddress('eip155');
      if (addr != null && addr.isNotEmpty) {
        debugPrint('[WalletConnect] Address via eip155: $addr');
        return addr;
      }
    } catch (e) {
      debugPrint('[WalletConnect] getAddress(eip155) error: $e');
    }

    // Fallback: try via selectedChain
    final chainId = _appKitModal!.selectedChain?.chainId;
    if (chainId != null) {
      try {
        final namespace = ReownAppKitModalNetworks.getNamespaceForChainId(chainId);
        final addr = session.getAddress(namespace);
        if (addr != null && addr.isNotEmpty) {
          debugPrint('[WalletConnect] Address via chain $chainId: $addr');
          return addr;
        }
      } catch (e) {
        debugPrint('[WalletConnect] getAddress via chain error: $e');
      }
    }

    // Last resort: parse from session accounts
    try {
      final accounts = session.getAccounts();
      if (accounts != null) {
        for (final account in accounts) {
          // CAIP-10 format: "eip155:11155111:0xAddress"
          final parts = account.split(':');
          if (parts.length >= 3 && parts.last.startsWith('0x')) {
            debugPrint('[WalletConnect] Address from accounts: ${parts.last}');
            return parts.last;
          }
        }
      }
    } catch (e) {
      debugPrint('[WalletConnect] accounts parse error: $e');
    }

    debugPrint('[WalletConnect] Could not extract address');
    return null;
  }

  @override
  void dispose() {
    _appKitModal?.onModalConnect.unsubscribe(_onConnect);
    _appKitModal?.onModalDisconnect.unsubscribe(_onDisconnect);
    _appKitModal?.onModalNetworkChange.unsubscribe(_onNetworkChange);
    _appKitModal?.onModalUpdate.unsubscribe(_onModalUpdate);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title:
            const Text('Wallet', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          if (!_isInitialized) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Initializing WalletConnect...'),
                ],
              ),
            );
          }

          if (_initError != null && !provider.isConnected) {
            return _buildInitError(context, provider);
          }

          if (provider.isConnected) {
            return _buildConnected(context, provider);
          }
          return _buildDisconnected(context, provider);
        },
      ),
    );
  }

  Widget _buildInitError(BuildContext context, AppProvider provider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 40),
          const Icon(Icons.warning_amber, size: 64, color: Colors.orange),
          const SizedBox(height: 16),
          const Text('WalletConnect initialization issue',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(_initError!, style: TextStyle(color: Colors.grey[400], fontSize: 13),
              textAlign: TextAlign.center),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
            onPressed: () {
              setState(() {
                _isInitialized = false;
                _initError = null;
              });
              _initWalletConnect();
            },
          ),
          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),
          _buildManualConnect(context, provider),
        ],
      ),
    );
  }

  Widget _buildDisconnected(BuildContext context, AppProvider provider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 40),
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.account_balance_wallet,
                size: 48, color: Colors.amber),
          ),
          const SizedBox(height: 24),
          const Text(
            'Connect Your Wallet',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Connect via MetaMask to start voting on memes with Yellow Network state channels',
            style: TextStyle(color: Colors.grey[400]),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // WalletConnect buttons
          if (_appKitModal != null) ...[
            AppKitModalNetworkSelectButton(appKit: _appKitModal!),
            const SizedBox(height: 12),
            AppKitModalConnectButton(appKit: _appKitModal!),
          ],

          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),

          // Backend health check
          OutlinedButton.icon(
            icon: _isChecking
                ? const SizedBox(
                    width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.wifi),
            label: const Text('Check Backend Connection'),
            onPressed: _isChecking ? null : () => _checkHealth(context, provider),
          ),
          const SizedBox(height: 8),
          Text(
            'Backend: $apiBaseUrl',
            style: TextStyle(color: Colors.grey[600], fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildManualConnect(BuildContext context, AppProvider provider) {
    final controller = TextEditingController();
    return Column(
      children: [
        Text('Or connect manually',
            style: TextStyle(color: Colors.grey[400], fontSize: 14)),
        const SizedBox(height: 12),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            labelText: 'Wallet Address',
            hintText: '0x...',
            border: const OutlineInputBorder(),
            prefixIcon: const Icon(Icons.wallet),
            suffixIcon: IconButton(
              icon: const Icon(Icons.paste),
              onPressed: () async {
                final data = await Clipboard.getData('text/plain');
                if (data?.text != null) controller.text = data!.text!;
              },
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.amber,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              final address = controller.text.trim();
              if (address.isEmpty || !address.startsWith('0x') || address.length != 42) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Enter a valid Ethereum address (0x...)'),
                    backgroundColor: Colors.red,
                  ),
                );
                return;
              }
              provider.connectWallet(address);
            },
            child: const Text('Connect Manually',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _buildConnected(BuildContext context, AppProvider provider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 20),
          // Yellow Network balance card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF3D2E00), Color(0xFF1A1200)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text('Sepolia Balance',
                          style: TextStyle(color: Colors.grey[400], fontSize: 14)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: provider.isYellowAuthenticated
                            ? Colors.green.withValues(alpha: 0.2)
                            : Colors.blue.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, size: 8,
                              color: provider.isYellowAuthenticated
                                  ? Colors.green : Colors.blue),
                          const SizedBox(width: 4),
                          Text(
                            provider.isYellowAuthenticated
                                ? 'Connected'
                                : 'Server Relay',
                            style: TextStyle(
                              fontSize: 11,
                              color: provider.isYellowAuthenticated
                                  ? Colors.green : Colors.blue,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  '${provider.ethBalance} ETH',
                  style: const TextStyle(
                    fontSize: 28, fontWeight: FontWeight.bold, color: Colors.amber,
                  ),
                ),
                const SizedBox(height: 4),
                Text('Sepolia Testnet • Votes are gasless via relay',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: provider.walletAddress!));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Address copied!')),
                    );
                  },
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          provider.walletAddress!,
                          style: TextStyle(color: Colors.grey[400], fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.copy, size: 14, color: Colors.grey[400]),
                    ],
                  ),
                ),
                if (provider.yellowError != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(provider.yellowError!,
                        style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),

          // WalletConnect account button
          if (_appKitModal != null && _appKitModal!.isConnected)
            AppKitModalAccountButton(appKitModal: _appKitModal!),

          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: _actionButton(Icons.refresh, 'Refresh',
                    () => provider.refreshBalance()),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionButton(Icons.water_drop, 'Faucet', () async {
                  try {
                    final result = await provider.api
                        .requestFaucet(provider.walletAddress!);
                    if (context.mounted) {
                      final success = result['success'] == true ||
                          result['message']?.toString().contains('already') == true;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(result['message']?.toString() ??
                              (success ? 'Faucet tokens sent!' : 'Faucet request failed')),
                          backgroundColor: success ? Colors.green : Colors.orange,
                        ),
                      );
                    }
                  // Refresh balance after faucet (wait a bit for tx to confirm)
                  Future.delayed(const Duration(seconds: 5), () => provider.fetchEthBalance());
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Faucet failed: ${e.toString().replaceFirst("Exception: ", "")}'),
                          backgroundColor: Colors.red,
                        ),
                      );
                    }
                  }
                }),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionButton(Icons.open_in_new, 'Explorer',
                    () => launchUrl(Uri.parse(
                        '$explorerUrl/address/${provider.walletAddress}'))),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Yellow Network info
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Yellow Network Info',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  _infoRow('Protocol', 'Nitrolite State Channels'),
                  _infoRow('Network', 'Sepolia Testnet'),
                  _infoRow('Asset', 'ytest.usd'),
                  _infoRow('Vote Cost', '$voteCostAmount ytest.usd'),
                  _infoRow('Channel',
                      provider.yellowChannelId?.substring(0, 16) ?? 'Not opened'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Disconnect
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Disconnect', style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () async {
                provider.disconnectWallet();
                // Also disconnect WalletConnect session
                if (_appKitModal != null && _appKitModal!.isConnected) {
                  try {
                    await _appKitModal!.disconnect();
                  } catch (_) {}
                }
                if (mounted) setState(() {});
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionButton(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[700]!),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.amber),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[400], fontSize: 13)),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
        ],
      ),
    );
  }

  void _checkHealth(BuildContext context, AppProvider provider) async {
    setState(() => _isChecking = true);
    try {
      final result = await provider.api.healthCheck();
      if (context.mounted) {
        final status = result['status'];
        String message;
        Color color;
        if (status == 'healthy') {
          final yellowStatus = result['yellow_network'];
          message =
              'Backend connected! Yellow Network: ${yellowStatus?['isConnected'] == true ? "connected" : "disconnected"}';
          color = Colors.green;
        } else if (status == 'unreachable') {
          message =
              'Backend unreachable at $apiBaseUrl. Make sure the server is running and your phone is on the same WiFi.';
          color = Colors.red;
        } else {
          message = 'Backend returned error. Check server logs.';
          color = Colors.orange;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: color,
              duration: const Duration(seconds: 4)),
        );
      }
    } finally {
      if (mounted) setState(() => _isChecking = false);
    }
  }
}
