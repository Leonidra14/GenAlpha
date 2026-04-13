import React from "react";
import AuthRegisterPage from "../components/auth/AuthRegisterPage";
import teacherIllustration from "../assets/teacher2.png";

export default function TeacherRegister() {
  return (
    <AuthRegisterPage
      title="Registrace učitele"
      navigateTo="/teacher"
      loginPath="/teacher/login"
      illustrationSrc={teacherIllustration}
      illustrationClassName="tloginTeacher"
    />
  );
}
