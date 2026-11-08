/**
 * Google Classroom API Service (Client-Side)
 * Beroperasi menggunakan access token OAuth dari Firebase Auth.
 */

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  courseState?: string;
  alternateLink?: string;
}

export interface ClassroomCourseWork {
  id: string;
  title: string;
  description?: string;
  state?: string;
  alternateLink?: string;
  maxPoints?: number;
  workType?: string;
}

export interface ClassroomStudent {
  userId: string;
  profile: {
    id: string;
    name: {
      fullName: string;
      givenName?: string;
      familyName?: string;
    };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomStudentSubmission {
  id: string;
  userId: string;
  courseId: string;
  courseWorkId: string;
  state: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  assignedGrade?: number;
  draftGrade?: number;
  alternateLink?: string;
}

export interface StudentMatchResult {
  studentNo: string;
  studentName: string;
  classGrade: string;
  examScore: number;
  maxScore: number;
  scaledGrade: number; // Skala 0-100 atau maxPoints tugas
  matchedClassroomUser?: ClassroomStudent;
  submissionId?: string;
  syncStatus: 'pending' | 'success' | 'failed' | 'unmatched';
  errorMessage?: string;
}

export class ClassroomService {
  private static BASE_URL = 'https://classroom.googleapis.com/v1';

  /**
   * Mengambil daftar kelas aktif yang diampu oleh guru
   */
  static async listCourses(accessToken: string): Promise<ClassroomCourse[]> {
    const res = await fetch(`${this.BASE_URL}/courses?teacherId=me&courseStates=ACTIVE`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal mengambil daftar kelas Google Classroom (${res.status})`);
    }

    const data = await res.json();
    return (data.courses || []) as ClassroomCourse[];
  }

  /**
   * Mengambil daftar tugas (CourseWork) dalam suatu kelas
   */
  static async listCourseWork(courseId: string, accessToken: string): Promise<ClassroomCourseWork[]> {
    const res = await fetch(`${this.BASE_URL}/courses/${courseId}/courseWork?courseWorkStates=PUBLISHED`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal mengambil daftar tugas (${res.status})`);
    }

    const data = await res.json();
    return (data.courseWork || []) as ClassroomCourseWork[];
  }

  /**
   * Membuat tugas baru (Assignment) di Google Classroom untuk paket ujian
   */
  static async createCourseWork(
    courseId: string, 
    payload: { title: string; description: string; maxPoints?: number },
    accessToken: string
  ): Promise<ClassroomCourseWork> {
    const res = await fetch(`${this.BASE_URL}/courses/${courseId}/courseWork`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        maxPoints: payload.maxPoints || 100,
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        submissionModificationMode: 'MODIFIABLE_UNTIL_TURNED_IN'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal membuat tugas di Google Classroom (${res.status})`);
    }

    return await res.json();
  }

  /**
   * Mengambil daftar seluruh siswa yang terdaftar di kelas
   */
  static async listStudents(courseId: string, accessToken: string): Promise<ClassroomStudent[]> {
    const students: ClassroomStudent[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const url: string = `${this.BASE_URL}/courses/${courseId}/students?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const res: Response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gagal mengambil daftar siswa kelas (${res.status})`);
      }

      const data: any = await res.json();
      if (Array.isArray(data.students)) {
        students.push(...data.students);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return students;
  }

  /**
   * Mengambil daftar lembar tugas siswa (studentSubmissions) untuk suatu CourseWork
   */
  static async listStudentSubmissions(
    courseId: string, 
    courseWorkId: string, 
    accessToken: string
  ): Promise<ClassroomStudentSubmission[]> {
    const submissions: ClassroomStudentSubmission[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const url: string = `${this.BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const res: Response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gagal mengambil lembar jawaban siswa (${res.status})`);
      }

      const data: any = await res.json();
      if (Array.isArray(data.studentSubmissions)) {
        submissions.push(...data.studentSubmissions);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return submissions;
  }

  /**
   * Mengirim dan mencantumkan nilai siswa ke Google Classroom
   */
  static async patchStudentGrade(
    courseId: string,
    courseWorkId: string,
    submissionId: string,
    grade: number,
    returnToStudent: boolean,
    accessToken: string
  ): Promise<void> {
    // 1. Simpan nilai (draftGrade & assignedGrade)
    const patchUrl = `${this.BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}?updateMask=assignedGrade,draftGrade`;
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        assignedGrade: Math.round(grade * 10) / 10,
        draftGrade: Math.round(grade * 10) / 10
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal memperbarui nilai di Google Classroom (${res.status})`);
    }

    // 2. Jika opsi 'Kembalikan ke siswa' aktif, publikasikan nilai resmi
    if (returnToStudent) {
      try {
        const returnUrl = `${this.BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}:return`;
        await fetch(returnUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
      } catch (returnErr) {
        console.warn('Gagal memanggil return submission, nilai tetap tersimpan sebagai assignedGrade:', returnErr);
      }
    }
  }

  /**
   * Algoritma pencocokan data siswa aplikasi dengan akun Google Classroom
   */
  static matchStudents(
    appStudents: Array<{ studentNo: string; fullName: string; classGrade?: string; score: number; maxScore?: number }>,
    classroomStudents: ClassroomStudent[],
    classroomSubmissions: ClassroomStudentSubmission[],
    maxPoints: number = 100
  ): StudentMatchResult[] {
    const normalize = (str: string) => 
      str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const submissionByUserId = new Map<string, ClassroomStudentSubmission>();
    classroomSubmissions.forEach(sub => {
      submissionByUserId.set(sub.userId, sub);
    });

    return appStudents.map(appStu => {
      const appNameNorm = normalize(appStu.fullName);
      const appNoNorm = normalize(appStu.studentNo);

      let bestMatch: ClassroomStudent | undefined = undefined;

      // 1. Coba cocokkan berdasarkan Email (jika ada NIS di email atau nama)
      bestMatch = classroomStudents.find(cs => {
        const email = (cs.profile.emailAddress || '').toLowerCase();
        return email.includes(appNoNorm) || (email && email.startsWith(appNameNorm.replace(/\s/g, '')));
      });

      // 2. Jika belum, cocokkan berdasarkan Nama Lengkap persis
      if (!bestMatch) {
        bestMatch = classroomStudents.find(cs => {
          const cNameNorm = normalize(cs.profile.name?.fullName || '');
          return cNameNorm === appNameNorm;
        });
      }

      // 3. Jika belum, cocokkan jika nama aplikasi termuat di dalam nama Classroom atau sebaliknya
      if (!bestMatch) {
        bestMatch = classroomStudents.find(cs => {
          const cNameNorm = normalize(cs.profile.name?.fullName || '');
          if (cNameNorm.length >= 4 && appNameNorm.length >= 4) {
            return cNameNorm.includes(appNameNorm) || appNameNorm.includes(cNameNorm);
          }
          return false;
        });
      }

      // Hitung skala nilai sesuai maxPoints tugas di Google Classroom
      const rawScore = Number(appStu.score) || 0;
      const rawMax = Number(appStu.maxScore) || 100;
      const scaledGrade = rawMax > 0 ? (rawScore / rawMax) * maxPoints : rawScore;

      const submission = bestMatch ? submissionByUserId.get(bestMatch.userId) : undefined;

      return {
        studentNo: appStu.studentNo,
        studentName: appStu.fullName,
        classGrade: appStu.classGrade || 'Umum',
        examScore: rawScore,
        maxScore: rawMax,
        scaledGrade: Math.round(scaledGrade * 10) / 10,
        matchedClassroomUser: bestMatch,
        submissionId: submission?.id,
        syncStatus: bestMatch && submission ? 'pending' : 'unmatched'
      };
    });
  }
}
