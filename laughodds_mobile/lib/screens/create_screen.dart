import 'dart:typed_data';
import 'dart:ui' as ui;
import 'dart:io' show File;
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import '../providers/app_provider.dart';
import '../services/ipfs_service.dart';

/// A single draggable text box on the meme
class _TextBox {
  final String id;
  String text;
  Offset position;
  double fontSize;
  Color color;

  _TextBox({
    required this.id,
    this.text = 'Add text',
    this.position = const Offset(50, 50),
    this.fontSize = 28,
    this.color = Colors.white,
  });
}

class CreateScreen extends StatefulWidget {
  const CreateScreen({super.key});

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> {
  int _stage = 0; // 0=pick/upload, 1=edit text, 2=share
  Uint8List? _selectedImage;
  final GlobalKey _captureKey = GlobalKey();
  Uint8List? _capturedImage;
  bool _isUploading = false;
  bool _isPickingImage = false;

  // Draggable text boxes
  final List<_TextBox> _textBoxes = [];
  int _selectedBoxIndex = -1;
  final TextEditingController _textEditController = TextEditingController();

  @override
  void dispose() {
    _textEditController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _stage == 0
              ? 'Create Meme'
              : _stage == 1
                  ? 'Add Text'
                  : 'Share',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        leading: _stage > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() {
                  _stage--;
                  if (_stage == 0) {
                    _capturedImage = null;
                    _textBoxes.clear();
                    _selectedBoxIndex = -1;
                  }
                }),
              )
            : null,
      ),
      body: _buildStage(),
    );
  }

  Widget _buildStage() {
    switch (_stage) {
      case 0:
        return _buildImagePicker();
      case 1:
        return _buildEditor();
      case 2:
        return _buildShare();
      default:
        return const SizedBox.shrink();
    }
  }

  // ─── Stage 0: Upload photo or pick from gallery ───
  Widget _buildImagePicker() {
    return Consumer<AppProvider>(
      builder: (context, provider, _) {
        if (!provider.isConnected) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.account_balance_wallet_outlined,
                    size: 64, color: Colors.amber),
                const SizedBox(height: 16),
                const Text('Connect your wallet to create memes',
                    style: TextStyle(fontSize: 16)),
              ],
            ),
          );
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 20),
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add_photo_alternate,
                    size: 48, color: Colors.blue),
              ),
              const SizedBox(height: 20),
              const Text(
                'Create Your Meme',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Upload a photo, add text anywhere, and publish it as a prediction market',
                style: TextStyle(color: Colors.grey[400], fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              // Upload from Gallery
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: _isPickingImage
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.photo_library),
                  label: const Text('Choose from Gallery',
                      style: TextStyle(fontSize: 16)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed:
                      _isPickingImage ? null : () => _pickImage(ImageSource.gallery),
                ),
              ),
              const SizedBox(height: 12),

              // Take Photo
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.camera_alt),
                  label:
                      const Text('Take a Photo', style: TextStyle(fontSize: 16)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed:
                      _isPickingImage ? null : () => _pickImage(ImageSource.camera),
                ),
              ),

              const SizedBox(height: 32),
              _buildExistingTemplates(provider),
            ],
          ),
        );
      },
    );
  }

  Widget _buildExistingTemplates(AppProvider provider) {
    final activeMarkets =
        provider.markets.where((m) => m.isActive && !m.isExpired).toList();
    if (activeMarkets.isEmpty && !provider.isLoadingMarkets) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(),
        const SizedBox(height: 12),
        Text('Or use an existing template',
            style: TextStyle(
                color: Colors.grey[400],
                fontSize: 14,
                fontWeight: FontWeight.w500)),
        const SizedBox(height: 12),
        if (provider.isLoadingMarkets)
          const Center(
              child: Padding(
                  padding: EdgeInsets.all(20),
                  child: CircularProgressIndicator()))
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: activeMarkets.length,
            itemBuilder: (context, index) {
              final market = activeMarkets[index];
              final cid = market.memes.isNotEmpty
                  ? market.memes.first.cid
                  : market.metadata;
              return GestureDetector(
                onTap: () => _loadTemplateFromIpfs(cid),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey[700]!),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Image.network(
                    'https://gateway.pinata.cloud/ipfs/$cid',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        const Center(child: Icon(Icons.image, color: Colors.grey)),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  // ─── Stage 1: Draggable text editor ───
  Widget _buildEditor() {
    if (_selectedImage == null) return const SizedBox.shrink();

    return Column(
      children: [
        // Image canvas with draggable text
        Expanded(
          child: Center(
            child: RepaintBoundary(
              key: _captureKey,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return Container(
                    color: Colors.black,
                    child: Stack(
                      children: [
                        // Full image (no cropping)
                        Center(
                          child: Image.memory(
                            _selectedImage!,
                            fit: BoxFit.contain,
                            width: constraints.maxWidth,
                            height: constraints.maxHeight,
                          ),
                        ),
                        // Draggable text boxes
                        ..._textBoxes.asMap().entries.map((entry) {
                          final i = entry.key;
                          final box = entry.value;
                          return Positioned(
                            left: box.position.dx,
                            top: box.position.dy,
                            child: GestureDetector(
                              onTap: () {
                                setState(() => _selectedBoxIndex = i);
                                _textEditController.text = box.text;
                              },
                              onPanUpdate: (details) {
                                setState(() {
                                  final newX = (box.position.dx +
                                          details.delta.dx)
                                      .clamp(0.0, constraints.maxWidth - 50);
                                  final newY = (box.position.dy +
                                          details.delta.dy)
                                      .clamp(0.0, constraints.maxHeight - 30);
                                  box.position = Offset(newX, newY);
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: _selectedBoxIndex == i
                                    ? BoxDecoration(
                                        border: Border.all(
                                            color: Colors.blue, width: 1.5),
                                        borderRadius: BorderRadius.circular(4),
                                      )
                                    : null,
                                child: Text(
                                  box.text,
                                  style: TextStyle(
                                    fontSize: box.fontSize,
                                    fontWeight: FontWeight.w900,
                                    color: box.color,
                                    shadows: const [
                                      Shadow(
                                          blurRadius: 4, color: Colors.black),
                                      Shadow(
                                          blurRadius: 8, color: Colors.black),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),

        // Controls bar
        _buildControls(),
      ],
    );
  }

  Widget _buildControls() {
    final hasSelection =
        _selectedBoxIndex >= 0 && _selectedBoxIndex < _textBoxes.length;
    final selectedBox = hasSelection ? _textBoxes[_selectedBoxIndex] : null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        border: Border(top: BorderSide(color: Colors.grey[800]!)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Add text + Generate row
          Row(
            children: [
              ElevatedButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add Text'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                onPressed: () {
                  final id = 'text-${DateTime.now().millisecondsSinceEpoch}';
                  setState(() {
                    _textBoxes.add(_TextBox(
                      id: id,
                      position: Offset(50, 50.0 + _textBoxes.length * 40),
                    ));
                    _selectedBoxIndex = _textBoxes.length - 1;
                    _textEditController.text = _textBoxes.last.text;
                  });
                },
              ),
              const Spacer(),
              ElevatedButton.icon(
                icon: const Icon(Icons.auto_awesome, size: 18),
                label: const Text('Generate'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                onPressed: _captureWidget,
              ),
            ],
          ),

          // Selected text box controls
          if (hasSelection && selectedBox != null) ...[
            const SizedBox(height: 10),
            // Text input
            TextField(
              controller: _textEditController,
              decoration: InputDecoration(
                labelText: 'Text',
                border: const OutlineInputBorder(),
                isDense: true,
                suffixIcon: IconButton(
                  icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                  onPressed: () {
                    setState(() {
                      _textBoxes.removeAt(_selectedBoxIndex);
                      _selectedBoxIndex = _textBoxes.isEmpty
                          ? -1
                          : min(_selectedBoxIndex, _textBoxes.length - 1);
                    });
                  },
                ),
              ),
              onChanged: (val) {
                setState(() => selectedBox.text = val);
              },
            ),
            const SizedBox(height: 8),
            // Font size + color
            Row(
              children: [
                // Font size controls
                Text('Size: ${selectedBox.fontSize.round()}',
                    style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline, size: 22),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    if (selectedBox.fontSize > 12) {
                      setState(() => selectedBox.fontSize -= 2);
                    }
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, size: 22),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    setState(() => selectedBox.fontSize += 2);
                  },
                ),
                const Spacer(),
                // Color chips
                ...[Colors.white, Colors.yellow, Colors.red, Colors.green, Colors.blue, Colors.black]
                    .map((c) => GestureDetector(
                          onTap: () => setState(() => selectedBox.color = c),
                          child: Container(
                            width: 22,
                            height: 22,
                            margin: const EdgeInsets.only(left: 4),
                            decoration: BoxDecoration(
                              color: c,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: selectedBox.color == c
                                    ? Colors.blue
                                    : Colors.grey[600]!,
                                width: selectedBox.color == c ? 2.5 : 1,
                              ),
                            ),
                          ),
                        )),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ─── Stage 2: Share & Publish ───
  Widget _buildShare() {
    if (_capturedImage == null) return const SizedBox.shrink();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.memory(_capturedImage!, fit: BoxFit.contain),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.share),
                  label: const Text('Share'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _shareMeme,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  icon: _isUploading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.cloud_upload),
                  label: Text(_isUploading ? 'Publishing...' : 'Publish'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isUploading ? null : _publishMeme,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Publish uploads to IPFS and creates an on-chain prediction market',
            style: TextStyle(color: Colors.grey[500], fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ─── Actions ───

  Future<void> _pickImage(ImageSource source) async {
    setState(() => _isPickingImage = true);
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (picked != null) {
        final bytes = await picked.readAsBytes();
        setState(() {
          _selectedImage = bytes;
          _textBoxes.clear();
          _selectedBoxIndex = -1;
          _stage = 1;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Failed to pick image: $e'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isPickingImage = false);
    }
  }

  Future<void> _loadTemplateFromIpfs(String cid) async {
    setState(() => _isPickingImage = true);
    try {
      final ipfs = IpfsService();
      final urls = ipfs.getAllUrls(cid);
      Uint8List? bytes;
      for (final url in urls) {
        try {
          final response =
              await http.get(Uri.parse(url)).timeout(const Duration(seconds: 10));
          if (response.statusCode == 200) {
            bytes = response.bodyBytes;
            break;
          }
        } catch (_) {
          continue;
        }
      }
      if (bytes != null) {
        setState(() {
          _selectedImage = bytes;
          _textBoxes.clear();
          _selectedBoxIndex = -1;
          _stage = 1;
        });
      } else {
        throw Exception('Could not load template');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Failed to load template: $e'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isPickingImage = false);
    }
  }

  Future<void> _captureWidget() async {
    // Deselect so the blue border isn't captured
    setState(() => _selectedBoxIndex = -1);
    // Wait for frame to render without selection border
    await Future.delayed(const Duration(milliseconds: 100));

    try {
      final boundary = _captureKey.currentContext!.findRenderObject()
          as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData != null) {
        setState(() {
          _capturedImage = byteData.buffer.asUint8List();
          _stage = 2;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to capture: $e')),
        );
      }
    }
  }

  Future<void> _shareMeme() async {
    if (_capturedImage == null) return;
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/viralforge_meme.png');
    await file.writeAsBytes(_capturedImage!);
    await Share.shareXFiles(
      [XFile(file.path)],
      text: 'Check out my meme on ViralForge!',
    );
  }

  Future<void> _publishMeme() async {
    if (_capturedImage == null) return;
    final provider = context.read<AppProvider>();
    if (!provider.isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connect wallet first')),
      );
      return;
    }

    setState(() => _isUploading = true);
    try {
      final ipfs = IpfsService();
      final cid = await ipfs.upload(_capturedImage!);

      // Create a new market on-chain with this meme's CID
      await provider.api.createMarket(cid: cid);

      // Refresh markets so the new meme appears in Gallery/Vote
      provider.loadMarkets();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Meme published on-chain!'),
            backgroundColor: Colors.green,
          ),
        );
        setState(() {
          _stage = 0;
          _selectedImage = null;
          _capturedImage = null;
          _textBoxes.clear();
          _selectedBoxIndex = -1;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Publish failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }
}
