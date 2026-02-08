import { BrowserRouter, Routes, Route } from "react-router-dom";

import RoleSelect from "./pages/RoleSelect";
import TeacherLogin from "./pages/TeacherLogin";
import RequireAuth from "./components/RequireAuth";
import TeacherMainPage from "./pages/TeacherMainPage";
import TeacherRegister from "./pages/TeacherRegister";
import TeacherClassDetail from "./pages/TeacherClassDetail";
import TeacherTopicDetail from "./pages/TeacherTopicDetail";
import StudentLogin from "./pages/StudentLogin";
import StudentMainPage from "./pages/StudentMainPage";
import StudentClassDetail from "./pages/StudentClassDetail";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Teacher */}
        <Route path="/" element={<RoleSelect />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher/register" element={<TeacherRegister />} />
        <Route path="/teacher/classes/:classId" element={<RequireAuth><TeacherClassDetail /></RequireAuth>} />
        <Route path="/teacher/classes/:classId/topics/:topicId" element={<TeacherTopicDetail />} />

        <Route
          path="/teacher"
          element={
            <RequireAuth>
              <TeacherMainPage />
            </RequireAuth>
          }
        />
        {/* Student */}
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student" element={<RequireAuth><StudentMainPage /></RequireAuth>} />
        <Route path="/student/classes/:classId" element={<StudentClassDetail />} />

      </Routes>
    </BrowserRouter>
  );
}
