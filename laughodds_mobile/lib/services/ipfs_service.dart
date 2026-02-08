import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/constants.dart';

class IpfsService {
  /// Upload base64 image data to Lighthouse IPFS
  /// Returns the CID hash
  Future<String> uploadToLighthouse(Uint8List imageBytes, String apiKey) async {
    final uri = Uri.parse('https://node.lighthouse.storage/api/v0/add');
    final request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $apiKey'
      ..files.add(http.MultipartFile.fromBytes(
        'file',
        imageBytes,
        filename: 'meme_${DateTime.now().millisecondsSinceEpoch}.png',
      ));

    final response = await request.send();
    final body = await response.stream.bytesToString();
    final data = jsonDecode(body);
    return data['Hash'] as String;
  }

  /// Upload image to Pinata IPFS (same as web app)
  /// Returns the CID hash
  Future<String> uploadToPinata(Uint8List imageBytes) async {
    final uri = Uri.parse('https://api.pinata.cloud/pinning/pinFileToIPFS');
    final request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $pinataJwt'
      ..files.add(http.MultipartFile.fromBytes(
        'file',
        imageBytes,
        filename: 'meme_${DateTime.now().millisecondsSinceEpoch}.png',
      ));

    final response = await request.send();
    final body = await response.stream.bytesToString();
    final data = jsonDecode(body);

    if (response.statusCode != 200) {
      throw Exception('Pinata upload failed: ${data['error'] ?? body}');
    }

    return data['IpfsHash'] as String;
  }

  /// Upload with fallback: try Pinata first, then Lighthouse
  Future<String> upload(Uint8List imageBytes) async {
    try {
      return await uploadToPinata(imageBytes);
    } catch (e) {
      debugPrint('[IPFS] Pinata upload failed: $e, trying Lighthouse...');
      return await uploadToLighthouse(imageBytes, '');
    }
  }

  /// Try loading an image from IPFS with gateway fallback
  /// Returns the first working URL
  Future<String?> resolveIpfsUrl(String cid) async {
    final cleanCid = cid
        .replaceFirst('ipfs://', '')
        .replaceFirst(RegExp(r'https?://[^/]+/ipfs/'), '');

    for (final gateway in ipfsGateways) {
      final url = '$gateway$cleanCid';
      try {
        final response = await http
            .head(Uri.parse(url))
            .timeout(const Duration(seconds: 5));
        if (response.statusCode == 200) return url;
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  /// Get the primary IPFS URL for a CID
  String getPrimaryUrl(String cid) {
    final cleanCid = cid
        .replaceFirst('ipfs://', '')
        .replaceFirst(RegExp(r'https?://[^/]+/ipfs/'), '');
    return '${ipfsGateways[0]}$cleanCid';
  }

  /// Get all fallback URLs for a CID
  List<String> getAllUrls(String cid) {
    return ipfsToHttpAll(cid);
  }
}
