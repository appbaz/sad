import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:uuid/uuid.dart';

import '../models.dart';
import '../utils.dart';

class AuthService {
  AuthService({FirebaseAuth? auth, FirebaseFirestore? db})
      : _auth = auth ?? FirebaseAuth.instance,
        _db = db ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  ChatUser? currentUser;

  Future<ChatUser> login({
    required String roomCode,
    required String password,
  }) async {
    final roomId = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(roomId)) {
      throw Exception('রুম কোড সঠিক নয়');
    }
    final plain = password.trim();
    if (plain.isEmpty) throw Exception('পাসওয়ার্ড দিন');

    final hash = await sha256Hex(plain);
    final members = await _db.collection('rooms').doc(roomId).collection('members').get();
    if (members.docs.isEmpty) {
      throw Exception('রুম পাওয়া যায়নি বা সদস্য নেই');
    }

    QueryDocumentSnapshot<Map<String, dynamic>>? match;
    for (final d in members.docs) {
      final stored = (d.data()['passwordHash'] as String? ?? '').trim();
      if (stored == hash) {
        match = d;
        break;
      }
    }
    if (match == null) {
      throw Exception('পাসওয়ার্ড ভুল');
    }

    final username = match.id;
    final displayName = (match.data()['name'] as String?)?.trim().isNotEmpty == true
        ? match.data()['name'] as String
        : username;

    final cred = await _auth.signInAnonymously();
    final uid = cred.user!.uid;
    final sessionId = const Uuid().v4();

    // Claim session on member doc
    await match.reference.set({
      'activeSessionId': sessionId,
      'activeUid': uid,
      'lastLoginAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    await _db.collection('users').doc(uid).set({
      'roomId': roomId,
      'username': username,
      'displayName': displayName,
      'role': 'chat',
      'sessionId': sessionId,
      'isOnline': true,
      'lastSeen': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    currentUser = ChatUser(
      uid: uid,
      roomId: roomId,
      username: username,
      displayName: displayName,
      sessionId: sessionId,
    );
    return currentUser!;
  }

  Future<void> logout() async {
    final u = currentUser;
    if (u != null) {
      try {
        await _db.collection('users').doc(u.uid).set({
          'isOnline': false,
          'lastSeen': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      } catch (_) {}
    }
    currentUser = null;
    await _auth.signOut();
  }

  Future<String> idToken({bool forceRefresh = false}) async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('লগইন নেই');
    final token = await user.getIdToken(forceRefresh);
    if (token == null || token.isEmpty) throw Exception('টোকেন পাওয়া যায়নি');
    return token;
  }
}
