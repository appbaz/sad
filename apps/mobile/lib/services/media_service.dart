import 'dart:convert';
import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import 'auth_service.dart';

class MediaUploadResult {
  MediaUploadResult({
    required this.fileId,
    required this.viewUrl,
    required this.thumbUrl,
    required this.mimeType,
    required this.bytes,
  });

  final String fileId;
  final String viewUrl;
  final String thumbUrl;
  final String mimeType;
  final int bytes;

  factory MediaUploadResult.fromJson(Map<String, dynamic> j) {
    return MediaUploadResult(
      fileId: j['fileId'] as String,
      viewUrl: j['viewUrl'] as String,
      thumbUrl: j['thumbUrl'] as String,
      mimeType: j['mimeType'] as String? ?? 'application/octet-stream',
      bytes: (j['bytes'] as num?)?.toInt() ?? 0,
    );
  }
}

class MediaService {
  MediaService(this._auth);

  final AuthService _auth;

  Future<File> compressImage(File file) async {
    final dir = await getTemporaryDirectory();
    final target = p.join(
      dir.path,
      'cmp_${DateTime.now().millisecondsSinceEpoch}.jpg',
    );
    final result = await FlutterImageCompress.compressAndGetFile(
      file.absolute.path,
      target,
      quality: AppConfig.compressQuality,
      minWidth: AppConfig.compressMaxWidth,
      minHeight: AppConfig.compressMaxWidth,
      format: CompressFormat.jpeg,
    );
    if (result == null) throw Exception('ছবি কম্প্রেস করা যায়নি');
    return File(result.path);
  }

  Future<MediaUploadResult> uploadFile({
    required File file,
    required String roomId,
    required String kind, // image | video
    String? mimeOverride,
  }) async {
    final token = await _auth.idToken(forceRefresh: true);
    final uri = Uri.parse('${AppConfig.mediaWorkerBaseUrl}/v1/media');

    final mime = mimeOverride ??
        (kind == 'video' ? 'video/mp4' : 'image/jpeg');
    final length = await file.length();
    final max = kind == 'video' ? AppConfig.maxVideoBytes : AppConfig.maxImageBytes;
    if (length > max) {
      throw Exception('ফাইল খুব বড়');
    }

    final req = http.MultipartRequest('POST', uri);
    req.headers['Authorization'] = 'Bearer $token';
    req.fields['roomId'] = roomId;
    req.fields['kind'] = kind;
    req.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType.parse(mime),
        filename: p.basename(file.path),
      ),
    );

    final streamed = await req.send();
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      String message = body;
      try {
        final j = jsonDecode(body) as Map<String, dynamic>;
        message = (j['message'] as String?) ?? (j['error'] as String?) ?? body;
      } catch (_) {}
      throw Exception('${streamed.statusCode}: $message');
    }

    final j = jsonDecode(body) as Map<String, dynamic>;
    return MediaUploadResult.fromJson(j);
  }

  /// Authenticated thumb URL with token query is not used; client loads via http with header.
  Future<http.Response> fetchThumb(String fileId) async {
    final token = await _auth.idToken();
    final uri = Uri.parse('${AppConfig.mediaWorkerBaseUrl}/v1/media/$fileId/thumb');
    return http.get(uri, headers: {'Authorization': 'Bearer $token'});
  }
}
