import { BrowserRouter, Routes, Route } from "react-router-dom";

import RoleSelect from "./pages/RoleSelect";
import TeacherLogin from "./pages/TeacherLogin";
import RequireAuth from "./components/RequireAuth";
import TeacherMainPage from "./pages/TeacherMainPage";
import TeacherRegister from "./pages/TeacherRegister";
import TeacherClassDetail from "./pages/TeacherClassDetail";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher/register" element={<TeacherRegister />} />
        <Route path="/teacher/classes/:classId" element={<RequireAuth><TeacherClassDetail /></RequireAuth>} />



        <Route
          path="/teacher"
          element={
            <RequireAuth>
              <TeacherMainPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
