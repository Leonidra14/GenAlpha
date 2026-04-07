import React from "react";
import AuthLoginPage from "../components/auth/AuthLoginPage";
import studentIllustration from "../assets/student2.png";

export default function StudentLogin() {
  return (
    <AuthLoginPage
      title="Přihlášení studenta"
      navigateTo="/student"
      illustrationSrc={studentIllustration}
      illustrationClassName="tloginStudent"
    />
  );
}
