import 'package:cloud_firestore/cloud_firestore.dart';

import '../models.dart';

class ChatService {
  ChatService({FirebaseFirestore? db}) : _db = db ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _messages(String roomId) =>
      _db.collection('rooms').doc(roomId).collection('messages');

  Stream<List<ChatMessage>> watchMessages(String roomId, {int limit = 100}) {
    return _messages(roomId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snap) {
      final list = snap.docs
          .map((d) => ChatMessage.fromDoc(d.id, d.data()))
          .toList();
      return list.reversed.toList();
    });
  }

  Future<void> sendText({
    required ChatUser me,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) throw Exception('মেসেজ খালি');
    if (trimmed.length > 1000) throw Exception('মেসেজ খুব লম্বা');

    await _messages(me.roomId).add({
      'type': 'text',
      'text': trimmed,
      'senderId': me.username,
      'senderName': me.displayName,
      'senderUid': me.uid,
      'read': false,
      'readBy': <String, dynamic>{},
      'deliveredBy': <String, dynamic>{},
      'reactions': <String, dynamic>{},
      'pinned': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> sendImageMessage({
    required ChatUser me,
    required String imageUrl,
    required String imageThumbUrl,
    required String driveFileId,
    String caption = '',
    int? width,
    int? height,
  }) async {
    await _messages(me.roomId).add({
      'type': 'image',
      'text': caption,
      'imageUrl': imageUrl,
      'imageThumbUrl': imageThumbUrl,
      'driveFileId': driveFileId,
      if (width != null) 'imageWidth': width,
      if (height != null) 'imageHeight': height,
      'senderId': me.username,
      'senderName': me.displayName,
      'senderUid': me.uid,
      'read': false,
      'readBy': <String, dynamic>{},
      'deliveredBy': <String, dynamic>{},
      'reactions': <String, dynamic>{},
      'pinned': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> sendVideoMessage({
    required ChatUser me,
    required String videoUrl,
    required String videoThumbUrl,
    required String driveFileId,
    String caption = '',
  }) async {
    await _messages(me.roomId).add({
      'type': 'video',
      'text': caption,
      'videoUrl': videoUrl,
      'videoThumbUrl': videoThumbUrl,
      'driveFileId': driveFileId,
      'senderId': me.username,
      'senderName': me.displayName,
      'senderUid': me.uid,
      'read': false,
      'readBy': <String, dynamic>{},
      'deliveredBy': <String, dynamic>{},
      'reactions': <String, dynamic>{},
      'pinned': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
