# Implementasi Fitur & Perbaikan Sistem ExamFlow Edu (SDN Pisangcandi 1)

Berikut adalah rangkuman implementasi 8 poin permintaan pengguna:

## 1. Pemilih Kelas pada Generator AI & Filter CP/TP Sesuai Kelas
- Menambahkan pemilih interaktif **"Pilih Tingkat Kelas / Fase"** pada `AiQuestionModal`:
  - Sekolah Dasar (SD): Kelas 1 & 2 (Fase A), Kelas 3 & 4 (Fase B), Kelas 5 & 6 (Fase C)
  - SMP: Kelas 7, 8, 9 (Fase D)
  - SMA: Kelas 10 (Fase E), Kelas 11 & 12 (Fase F)
  - Kelas Paket Ujian atau Tampilkan Semua.
- Dropdown **Capaian Pembelajaran (CP)** dan **Tujuan Pembelajaran (TP)** disaring secara dinamis sesuai kelas/fase yang dipilih.

## 2. Deteksi Sinkronisasi CP/TP Google Sheets (Bebas Masalah Dummy)
- Mengatasi kendala header Bahasa Indonesia dari Google Sheets (`Mata Pelajaran`, `Capaian Pembelajaran`, `Tujuan Pembelajaran`, `Elemen`, `Jenjang / Kelas`) sehingga langsung terpetakan ke struktur sistem.
- Menambahkan parser robust untuk butir TP multi-baris/penomoran dari Spreadsheet.
- Menambahkan filter dan tombol **"Bersihkan Template Dummy"** pada menu Kurikulum agar data contoh lama (seperti Biologi) dapat dibersihkan dengan satu klik tanpa menghapus data asli.

## 3. Logo Pemerintah Daerah di Sebelah Kiri Kop Surat
- Menambahkan konfigurasi `regionalGovLogoUrl` dengan dukungan:
  - Input URL gambar logo pemda.
  - Unggah file logo langsung dari perangkat (Base64).
  - Pratinjau langsung logo pemda di formulir profil.
- Menempatkan **Logo Pemda di sebelah KIRI** kop surat pada seluruh dokumen resmi cetak (`OfficialReportPrintView`, `OfficialExamPrintView`, `KisiKisiMatrix`, dan pratinjau dashboard).

## 4. Hirarki Kop Surat: Organisasi Perangkat Daerah (OPD) di Bawah Pemda
- Menambahkan formulir input `regionalGovName` (Nama Pemerintah Daerah) dan `regionalGovDepartment` (Nama Organisasi Perangkat Daerah / OPD).
- Mengatur tata naskah dinas resmi pada Kop Surat:
  - **Baris 1**: Nama Pemerintah Daerah (contoh: `PEMERINTAH KOTA MALANG`)
  - **Baris 2**: Nama Organisasi Perangkat Daerah (contoh: `DINAS PENDIDIKAN DAN KEBUDAYAAN`)
  - **Baris 3**: Nama Satuan Pendidikan (contoh: `SD NEGERI PISANGCANDI 1 MALANG`)
  - **Baris 4**: Alamat Sekolah
  - **Baris 5**: NPSN, Tahun Ajaran, dan Semester.

## 5. Penyimpanan Mata Pelajaran Baru Secara Persisten
- Menambahkan manajemen penyimpanan persisten `custom_subjects` di `StorageService`.
- Setiap mata pelajaran baru yang ditambahkan di menu CP/TP otomatis tersimpan dan langsung muncul di semua dropdown pilihan mapel di seluruh aplikasi.

## 6. Integritas Kunci Jawaban Soal Pilihan Ganda AI
- Memperbaiki prompt AI agar kunci jawaban (`correctKey`) **selalu menunjuk ke opsi yang memuat pernyataan yang 100% benar dan faktual**.
- Menghapus double-swapping opsi pada pemrosesan pasca-generasi agar kunci jawaban dan konten pertanyaan selalu sinkron.

## 7. Peningkatan Kualitas Soal HOTS & Stimulus Mendalam
- Menginstruksikan AI untuk menyusun stimulus soal HOTS yang kaya dan kontekstual (2-4 paragraf narasi, studi kasus, data tabel, atau dialog pemecahan masalah).
- Murid diarahkan untuk membaca secara teliti (*close reading*) dan melakukan analisis kritis sebelum dapat menentukan pilihan jawaban.
