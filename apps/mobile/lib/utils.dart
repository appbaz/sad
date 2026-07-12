import 'dart:convert';

import 'package:crypto/crypto.dart';

String normalizeRoomCode(String raw) {
  return raw.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '');
}

bool isValidRoomCode(String code) {
  return RegExp(r'^(?:[a-z][a-z0-9_-]{2,23}|[0-9]{4,8}|[a-z0-9]{12,20})$')
      .hasMatch(code);
}

Future<String> sha256Hex(String input) async {
  final bytes = utf8.encode(input);
  return sha256.convert(bytes).toString();
}

String formatBnError(Object err) {
  final msg = err.toString();
  if (msg.contains('SocketException') || msg.contains('Failed host lookup')) {
    return 'ইন্টারনেট সংযোগ নেই';
  }
  if (msg.contains('401') || msg.contains('unauthorized')) {
    return 'সেশন শেষ — আবার লগইন করুন';
  }
  if (msg.contains('403') || msg.contains('forbidden')) {
    return 'এই রুমে অনুমতি নেই';
  }
  if (msg.contains('413') || msg.contains('too_large')) {
    return 'ফাইল খুব বড়';
  }
  if (msg.contains('429') || msg.contains('rate_limited')) {
    return 'অনেক অনুরোধ — একটু পরে চেষ্টা করুন';
  }
  if (msg.contains('415') || msg.contains('unsupported')) {
    return 'এই ফাইল টাইপ পাঠানো যাবে না';
  }
  if (RegExp(r'[\u0980-\u09FF]').hasMatch(msg)) {
    final cleaned = msg.replaceFirst('Exception: ', '').replaceFirst('Error: ', '');
    if (cleaned.length < 160) return cleaned;
  }
  return 'কিছু ভুল হয়েছে — আবার চেষ্টা করুন';
}
