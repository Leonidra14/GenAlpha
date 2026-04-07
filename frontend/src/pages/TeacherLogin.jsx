import React from "react";
import AuthLoginPage from "../components/auth/AuthLoginPage";
import teacherIllustration from "../assets/teacher2.png";

export default function TeacherLogin() {
  return (
    <AuthLoginPage
      title="Přihlášení učitele"
      navigateTo="/teacher"
      illustrationSrc={teacherIllustration}
      illustrationClassName="tloginTeacher"
      showRegister
      registerPath="/teacher/register"
    />
  );
}
