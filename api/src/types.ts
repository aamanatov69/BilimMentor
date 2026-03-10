export type UserRole = "student" | "teacher" | "admin";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
}

export interface CourseModule {
  id: string;
  title: string;
  durationMinutes: number;
  isCompleted: boolean;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  progress: number;
  modules: CourseModule[];
}
