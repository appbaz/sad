class ChatUser {
  ChatUser({
    required this.uid,
    required this.roomId,
    required this.username,
    required this.displayName,
    this.sessionId,
  });

  final String uid;
  final String roomId;
  final String username;
  final String displayName;
  final String? sessionId;

  bool get isPrimary => username == 'm1';
}

enum MessageType { text, image, video, link, system }

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.type,
    required this.senderId,
    required this.senderName,
    required this.senderUid,
    this.text = '',
    this.imageUrl,
    this.imageThumbUrl,
    this.videoUrl,
    this.videoThumbUrl,
    this.driveFileId,
    this.createdAt,
    this.localStatus,
  });

  final String id;
  final MessageType type;
  final String senderId;
  final String senderName;
  final String senderUid;
  final String text;
  final String? imageUrl;
  final String? imageThumbUrl;
  final String? videoUrl;
  final String? videoThumbUrl;
  final String? driveFileId;
  final DateTime? createdAt;
  final String? localStatus;

  factory ChatMessage.fromDoc(String id, Map<String, dynamic> data) {
    MessageType type;
    switch (data['type'] as String? ?? 'text') {
      case 'image':
        type = MessageType.image;
        break;
      case 'video':
        type = MessageType.video;
        break;
      case 'link':
        type = MessageType.link;
        break;
      case 'system':
        type = MessageType.system;
        break;
      default:
        type = MessageType.text;
    }

    DateTime? createdAt;
    final raw = data['createdAt'];
    if (raw is DateTime) {
      createdAt = raw;
    } else if (raw != null) {
      try {
        createdAt = (raw as dynamic).toDate() as DateTime;
      } catch (_) {}
    }

    return ChatMessage(
      id: id,
      type: type,
      senderId: data['senderId'] as String? ?? '',
      senderName: data['senderName'] as String? ?? '',
      senderUid: data['senderUid'] as String? ?? '',
      text: data['text'] as String? ?? '',
      imageUrl: data['imageUrl'] as String?,
      imageThumbUrl: data['imageThumbUrl'] as String?,
      videoUrl: data['videoUrl'] as String?,
      videoThumbUrl: data['videoThumbUrl'] as String?,
      driveFileId: data['driveFileId'] as String?,
      createdAt: createdAt,
    );
  }

  bool get isMine => false; // set in UI via comparison
}
