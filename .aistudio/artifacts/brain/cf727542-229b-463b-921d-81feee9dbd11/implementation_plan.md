# Aturan Pelaksanaan & Alur Ujian Siswa

## 1. Pembahasan Butir Soal (Per-Question Explanation)
- Saat siswa memilih opsi atau mengetikkan esai pada suatu butir soal, **penjelasan/pembahasan konsep materi dan status kebenaran TIDAK langsung muncul**.
- Pembahasan baru akan terbuka secara interaktif ketika siswa menekan tombol **"Selanjutnya"** (atau tombol "Buka Pembahasan Soal Ini" pada nomor terakhir).
- Setelah ditekan, pembahasan materi dan status (*Jawaban Anda Benar* / *Jawaban Belum Tepat*) akan ditampilkan, tombol navigasi berubah menjadi **"Lanjut ke Soal No. X"**, dan siswa dapat menelaah konsep materi sebelum berpindah nomor.
- Kunci jawaban yang benar tetap dirahasiakan selama ujian berlangsung sesuai standar integritas asesmen.

## 2. Penguncian Jawaban Sementara Hingga Seluruh Soal Dijawab
- Setelah penjelasan suatu butir soal terbuka, jawaban pada butir tersebut akan dikunci sementara.
- Siswa **baru diperbolehkan mengubah atau merevisi jawaban setelah SELURUH butir soal dalam ujian selesai dijawab** (`answeredCount === totalQuestions`).
- Jika siswa mencoba mengganti pilihan sebelum seluruh soal terjawab, sistem akan menampilkan notifikasi bahwa jawaban terkunci sementara.

## 3. Pembatasan Revisi Maksimal 5 Butir Soal
- Begitu seluruh butir soal selesai dijawab, sistem mengaktifkan **Mode Revisi** dan mencatat snapshot jawaban awal.
- Siswa hanya diberikan kuota untuk merevisi atau mengubah jawaban dari **maksimal 5 butir soal**.
- Jika siswa telah mengubah 5 butir soal dan mencoba merevisi soal ke-6, sistem akan memblokir perubahan dan menginformasikan bahwa batas kuota 5 revisi telah penuh.
- Daftar nomor soal yang telah direvisi ditandai secara visual di daftar nomor soal (lingkaran ungu / badge revisi).

## 4. Peringatan Khusus di Nomor Terakhir Sebelum Submit
- Pada nomor soal terakhir sebelum mengirimkan ujian, sistem menyajikan kartu peringatan mencolok (*Alert Warning Banner*):
  - **Status Kelengkapan Soal**: Menampilkan jumlah soal yang sudah/belum dijawab.
  - **Aturan Kuota Revisi**: Menampilkan kuota perubahan jawaban yang telah terpakai (`X / 5 Soal`) beserta daftar nomor soal yang telah diubah.
  - **Konfirmasi Pengiriman**: Dialog peringatan sebelum penyerahan final ujian ke server Google Apps Script dan Google Classroom.
