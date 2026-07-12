import 'dart:io';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/auth_service.dart';
import '../services/chat_service.dart';
import '../services/media_service.dart';
import '../utils.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.auth,
    required this.chat,
    required this.media,
    required this.onLogout,
  });

  final AuthService auth;
  final ChatService chat;
  final MediaService media;
  final VoidCallback onLogout;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _picker = ImagePicker();
  bool _uploading = false;
  String? _banner;

  ChatUser get me => widget.auth.currentUser!;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _sendText() async {
    final text = _input.text;
    if (text.trim().isEmpty) return;
    try {
      await widget.chat.sendText(me: me, text: text);
      _input.clear();
    } catch (e) {
      _show(formatBnError(e));
    }
  }

  Future<void> _pickImage() async {
    try {
      final x = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 95);
      if (x == null) return;
      setState(() {
        _uploading = true;
        _banner = 'ছবি আপলোড হচ্ছে…';
      });
      final raw = File(x.path);
      final compressed = await widget.media.compressImage(raw);
      final uploaded = await widget.media.uploadFile(
        file: compressed,
        roomId: me.roomId,
        kind: 'image',
        mimeOverride: 'image/jpeg',
      );
      await widget.chat.sendImageMessage(
        me: me,
        imageUrl: uploaded.viewUrl,
        imageThumbUrl: uploaded.thumbUrl,
        driveFileId: uploaded.fileId,
        caption: _input.text.trim(),
      );
      _input.clear();
      setState(() => _banner = null);
    } catch (e) {
      _show(formatBnError(e));
      setState(() => _banner = null);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _pickVideo() async {
    try {
      final x = await _picker.pickVideo(source: ImageSource.gallery);
      if (x == null) return;
      setState(() {
        _uploading = true;
        _banner = 'ভিডিও আপলোড হচ্ছে…';
      });
      final file = File(x.path);
      final uploaded = await widget.media.uploadFile(
        file: file,
        roomId: me.roomId,
        kind: 'video',
        mimeOverride: 'video/mp4',
      );
      await widget.chat.sendVideoMessage(
        me: me,
        videoUrl: uploaded.viewUrl,
        videoThumbUrl: uploaded.thumbUrl,
        driveFileId: uploaded.fileId,
        caption: _input.text.trim(),
      );
      _input.clear();
      setState(() => _banner = null);
    } catch (e) {
      _show(formatBnError(e));
      setState(() => _banner = null);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _show(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF075E54),
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(me.displayName, style: const TextStyle(fontSize: 16)),
            Text(
              '${me.roomId} · ${me.username}',
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'লগআউট',
            onPressed: () async {
              await widget.auth.logout();
              widget.onLogout();
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_banner != null || _uploading)
            Material(
              color: Colors.amber.shade100,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    if (_uploading)
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    if (_uploading) const SizedBox(width: 8),
                    Expanded(child: Text(_banner ?? '')),
                  ],
                ),
              ),
            ),
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: widget.chat.watchMessages(me.roomId),
              builder: (context, snap) {
                if (snap.hasError) {
                  return Center(child: Text(formatBnError(snap.error!)));
                }
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final messages = snap.data!;
                if (messages.isEmpty) {
                  return const Center(child: Text('এখনো কোনো মেসেজ নেই'));
                }
                return ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: messages.length,
                  itemBuilder: (context, i) {
                    final m = messages[i];
                    final mine = m.senderUid == me.uid || m.senderId == me.username;
                    return _Bubble(
                      message: m,
                      mine: mine,
                      auth: widget.auth,
                      media: widget.media,
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _uploading ? null : _pickImage,
                    icon: const Icon(Icons.image_outlined),
                    tooltip: 'ছবি',
                  ),
                  IconButton(
                    onPressed: _uploading ? null : _pickVideo,
                    icon: const Icon(Icons.videocam_outlined),
                    tooltip: 'ভিডিও',
                  ),
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'মেসেজ লিখুন…',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      enabled: !_uploading,
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton.filled(
                    onPressed: _uploading ? null : _sendText,
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFF075E54),
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.message,
    required this.mine,
    required this.auth,
    required this.media,
  });

  final ChatMessage message;
  final bool mine;
  final AuthService auth;
  final MediaService media;

  @override
  Widget build(BuildContext context) {
    final bg = mine ? const Color(0xFFDCF8C6) : Colors.white;
    final align = mine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final time = message.createdAt != null
        ? DateFormat('HH:mm').format(message.createdAt!.toLocal())
        : '';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.78,
            ),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!mine)
                  Text(
                    message.senderName,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF075E54),
                    ),
                  ),
                if (message.type == MessageType.image) ...[
                  const SizedBox(height: 4),
                  _AuthNetworkImage(
                    viewUrl: message.imageUrl,
                    thumbUrl: message.imageThumbUrl,
                    fileId: message.driveFileId,
                    media: media,
                  ),
                ],
                if (message.type == MessageType.video) ...[
                  const SizedBox(height: 4),
                  _VideoPlaceholder(
                    thumbUrl: message.videoThumbUrl,
                    viewUrl: message.videoUrl,
                    fileId: message.driveFileId,
                    media: media,
                  ),
                ],
                if (message.text.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(message.text),
                ],
                if (time.isNotEmpty)
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Text(
                      time,
                      style: const TextStyle(fontSize: 10, color: Colors.black45),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthNetworkImage extends StatefulWidget {
  const _AuthNetworkImage({
    this.viewUrl,
    this.thumbUrl,
    this.fileId,
    required this.media,
  });

  final String? viewUrl;
  final String? thumbUrl;
  final String? fileId;
  final MediaService media;

  @override
  State<_AuthNetworkImage> createState() => _AuthNetworkImageState();
}

class _AuthNetworkImageState extends State<_AuthNetworkImage> {
  Uint8List? _bytes;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      if (widget.fileId != null) {
        final res = await widget.media.fetchThumb(widget.fileId!);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (mounted) setState(() => _bytes = res.bodyBytes);
          return;
        }
      }
      // Fallback: public view URL (anyone-with-link)
      if (widget.viewUrl != null && widget.viewUrl!.isNotEmpty) {
        if (mounted) setState(() => _bytes = null);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Text(formatBnError(_error!), style: const TextStyle(color: Colors.red));
    }
    if (_bytes != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(_bytes!, fit: BoxFit.cover),
      );
    }
    if (widget.viewUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: CachedNetworkImage(
          imageUrl: widget.viewUrl!,
          fit: BoxFit.cover,
          placeholder: (_, __) => const SizedBox(
            height: 120,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          errorWidget: (_, __, ___) => const Text('ছবি লোড হয়নি'),
        ),
      );
    }
    return const SizedBox(
      height: 80,
      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
    );
  }
}

class _VideoPlaceholder extends StatelessWidget {
  const _VideoPlaceholder({
    this.thumbUrl,
    this.viewUrl,
    this.fileId,
    required this.media,
  });

  final String? thumbUrl;
  final String? viewUrl;
  final String? fileId;
  final MediaService media;

  @override
  Widget build(BuildContext context) {
    return _AuthNetworkImage(
      viewUrl: viewUrl,
      thumbUrl: thumbUrl,
      fileId: fileId,
      media: media,
    );
  }
}
