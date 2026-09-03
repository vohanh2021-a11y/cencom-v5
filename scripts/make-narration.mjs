/**
 * make-narration.mjs — Tạo file phụ đề + lồng tiếng cho video UAT.
 *
 * - Ưu tiên dùng gtts-cli (npm install -g gtts-cli hoặc cài trong project).
 * - Nếu không có → dùng Windows SAPI qua PowerShell (có sẵn trên Windows).
 * - Merge audio vào video bằng ffmpeg: out.mp4 giữ video, thay codec audio AAC.
 * - Script nhận tham số: --video <đường_dẫn_video> hoặc vị trí mặc định.
 * - Xuất: videos/uat-tour.mp4
 *
 * Cách dùng:
 *   node scripts/make-narration.mjs --video videos/cencom-ux-tour-20240820.webm
 *   hoặc chỉ chạy: node scripts/make-narration.mjs (sẽ tìm file mới nhất trong videos/)
 *
 * Yêu cầu cài đặt:
 *   - gtts-cli: `pip install gtts` (Python) hoặc `npm i gtts-cli`
 *   - ffmpeg: https://ffmpeg.org/download.html -> thêm PATH Windows, hoặc dùng winget/chocolatey.
 *   - PowerShell (cho fallback SAPI): đã có sẵn Windows 10/11.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, readdirSync, statSync } from 'node:fs';

// --- Cấu hình ---
const VIDEOS_DIR = resolve('videos');
const OUTPUT_FILE = resolve(VIDEOS_DIR, 'uat-tour.mp4');
const AUDIO_FILE = resolve(VIDEOS_DIR, 'narration.mp3');

// Văn bản nghe dẫn tiếng Việt cho từng bước tour
const NARRATION_TEXTS = [
  { step: 1, text: 'Bước 1: Truy cập trang đăng nhập cencomOS v5.0. Vui lòng nhập tài khoản admin-1 và mật khẩu cencom@123.' },
  { step: 2, text: 'Bước 2: Đăng nhập thành công, hệ thống sẽ chuyển hướng về trang dashboard. Bạn sẽ thấy tổng quan KPI và chart thống kê.' },
  { step: 3, text: 'Bước 3: Vào trang phiếu sửa chữa. Đ đây là nơi quản lý các vụ sửa xe đầu kéo, xem danh sách phiếu và trạng thái tiến độ.' },
  { step: 4, text: 'Bước 4: Vào mục Kho. Xem tổng quan vật tư, phiếu nhập và phiếu xuất kho.' },
  { step: 5, text: 'Bước 5: Truy cập trang Báo giá NCC. Xem và quản lý các báo giá từ nhà cung cấp phụ tùng.' },
  { step: 6, text: 'Bước 6: Vào mục Hồ sơ. Xem và quản lý các hồ sơ kế toán, chứng từ tài chính.' },
  { step: 7, text: 'Bước 7: Logout thoát hệ thống. Chọn đăng xuất để kết thúc phiên làm việc.' },
];

// --- Helper: chạy lệnh và check exit code ---
function runCmd(cmd, opts = {}) {
  try {
    execSync(cmd, { ...opts, stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

// --- Helper: kiểm tra ffmpeg có sẵn không ---
function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// --- Helper: cài gtts-cli qua pip ---
function installGTTs() {
  console.log('🔧 Cài gtts-cli qua pip...');
  const ok = runCmd('pip install gtts-cli 2>&1', { timeout: 60000 });
  return ok;
}

// --- Helper: tạo audio SAPI Windows ---
function createAudioSAPI(text, outputPath) {
  console.log('🔧 Tạo audio qua Windows SAPI (PowerShell)...');
  const script = `
Add-Type -AssemblyName System.Speech;
$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$rate = $speech.Rate; $speech.Rate = -2; // Nhanh hơn một chút
$builder = New-Object System.Speech.Audio.OutputFormat.WaveAudioOutputStream;
$stream = New-Object System.IO.MemoryStream;
$speech.SetOutputToWaveStream($stream);
$speech.Speak('${text.replace(/'/g, "\\'")}');
$stream.Position = 0;
[System.IO.File]::WriteAllBytes('${outputPath}', $stream.ToArray());
`;
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    return true;
  } catch (e) {
    console.warn('⚠️ SAPI failed:', e.message);
    return false;
  }
}

// --- Helper: tạo audio gtts ---
function createAudioGTTs(text, outputPath) {
  console.log('🔧 Tạo audio qua gtts-cli...');
  try {
    // gtts-cli: `gtts --text "text" --language vi --output output.mp3`
    runCmd(`gtts --text "${text.replace(/"/g, '\\"')}" --language vi --output "${outputPath}"`, {
      stdio: 'pipe',
    });
    return true;
  } catch (e) {
    console.warn('⚠️ gtts-cli failed:', e.message);
    return false;
  }
}

// --- Chạy chính ---
async function main() {
  console.log('🎤 Bắt đầu tạo narration (phụ đề + lồng tiếng)...');

  // 1. Tìm file video đầu tiên trong videos/
  let videoPath = process.argv.find((arg) => arg.startsWith('--video='))?.split('=')[1];
  if (!videoPath) {
    const files = readdirSync(VIDEOS_DIR).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4')).sort();
    if (files.length === 0) {
      console.error('❌ Không tìm thấy file video nào trong thư mục videos/.');
      console.error('   Cách dùng: node scripts/make-narration.mjs --video <đường_dẫn_video>');
      process.exit(1);
    }
    videoPath = path.join(VIDEOS_DIR, files[files.length - 1]);
    console.log(`📁 File video mặc định: ${videoPath}`);
  }

  if (!statSync(videoPath).isFile()) {
    console.error(`❌ File video không tồn tại: ${videoPath}`);
    process.exit(1);
  }

  // 2. Tạo audio narration
  const viTexts = NARRATION_TEXTS.map((t) => t.text).join(' ');
  let audioOk = false;

  // Thử gtts-cli trước
  try {
    const gttsExists = runCmd(`gtts --version 2>&1`, { stdio: 'pipe' });
    if (gttsExists) {
      audioOk = createAudioGTTs(viTexts, AUDIO_FILE);
    }
  } catch {
    // bỏ qua
  }

  // Nếu gtts thất bại hoặc không có, dùng SAPI Windows
  if (!audioOk) {
    audioOk = createAudioSAPI(viTexts, AUDIO_FILE);
  }

  if (!audioOk) {
    console.error('❌ Không thể tạo file audio.');
    console.error('   Cách khắc phục:');
    console.error('   1. Cài gtts-cli: `pip install gtts-cli`');
    console.error('   2. Hoặc đảm bảo ffmpeg có sẵn PATH Windows.');
    console.error('   3. Hoặc kiểm tra PowerShell có chạy không.');
    process.exit(1);
  }

  console.log(`  ✅ Audio narration tạo: ${AUDIO_FILE}`);

  // 3. Merge audio vào video bằng ffmpeg
  if (!checkFfmpeg()) {
    console.error('❌ ffmpeg không tìm thấy trong PATH!');
    console.error('   Cài ffmpeg:');
    console.error('   - Tải từ: https://ffmpeg.org/download.html');
    console.error('   - Hoặc winget: `winget install FFmpeg.FFmpeg`');
    console.error('   - Hoặc chocolatey: `choco install ffmpeg`');
    console.error('   Sau khi cài, restart terminal và chạy lại script.');
    process.exit(1);
  }

  console.log('🔧 Đang merge video + audio...');
  const mergeCmd = `ffmpeg -i "${videoPath}" -i "${AUDIO_FILE}" -c:v copy -c:a aac -y "${OUTPUT_FILE}"`;
  const mergeOk = runCmd(mergeCmd, { stdio: 'pipe' });

  if (!mergeOk) {
    console.error('❌ Merge ffmpeg thất bại.');
    process.exit(1);
  }

  console.log(`  ✅ Video đã xuất: ${OUTPUT_FILE}`);

  // 4. (Tùy chọn) Xóa file audio tạm
  try {
    // không xóa audio để user giữ lại, chỉ log
    console.log('   ℹ️ File audio tạm giữ tại:', AUDIO_FILE);
  } catch {}

  console.log('🎉 Hoàn narration xong! File: videos/uat-tour.mp4');
}

main().catch((e) => {
  console.error('❌ Lỗi không mong muốn:', e);
  process.exit(1);
});