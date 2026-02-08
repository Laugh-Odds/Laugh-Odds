import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../config/constants.dart';

class IpfsImage extends StatefulWidget {
  final String cid;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  const IpfsImage({
    super.key,
    required this.cid,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  @override
  State<IpfsImage> createState() => _IpfsImageState();
}

class _IpfsImageState extends State<IpfsImage> {
  int _gatewayIndex = 0;

  String get _currentUrl {
    final urls = ipfsToHttpAll(widget.cid);
    return urls[_gatewayIndex % urls.length];
  }

  void _tryNextGateway() {
    if (_gatewayIndex < ipfsGateways.length - 1) {
      setState(() => _gatewayIndex++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final image = CachedNetworkImage(
      imageUrl: _currentUrl,
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      placeholder: (_, __) => Container(
        width: widget.width,
        height: widget.height,
        color: Colors.grey[800],
        child: const Center(
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      errorWidget: (_, __, ___) {
        if (_gatewayIndex < ipfsGateways.length - 1) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _tryNextGateway());
          return Container(
            width: widget.width,
            height: widget.height,
            color: Colors.grey[800],
            child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }
        return Container(
          width: widget.width,
          height: widget.height,
          color: Colors.grey[800],
          child: const Icon(Icons.broken_image, color: Colors.grey, size: 40),
        );
      },
    );

    if (widget.borderRadius != null) {
      return ClipRRect(borderRadius: widget.borderRadius!, child: image);
    }
    return image;
  }
}
