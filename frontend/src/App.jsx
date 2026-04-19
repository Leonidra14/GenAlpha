/**
 * Route map: teacher vs student areas, quiz session + results (attemptId in URL for main/bonus).
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";

import RoleSelect from "./pages/RoleSelect";
import TeacherLogin from "./pages/TeacherLogin";
import RequireAuth from "./components/RequireAuth";
import TeacherMainPage from "./pages/TeacherMainPage";
import TeacherRegister from "./pages/TeacherRegister";
import TeacherClassDetail from "./pages/TeacherClassDetail";
import TeacherClassStats from "./pages/TeacherClassStats";
import TeacherTopicDetail from "./pages/TeacherTopicDetail";
import TeacherTopicQuizStats from "./pages/TeacherTopicQuizStats";
import StudentLogin from "./pages/StudentLogin";
import StudentMainPage from "./pages/StudentMainPage";
import StudentClassDetail from "./pages/StudentClassDetail";
import StudentTopicDetail from "./pages/StudentTopicDetail";
import StudentQuizSession from "./pages/StudentQuizSession";
import StudentQuizResults from "./pages/StudentQuizResults";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Teacher */}
        <Route path="/" element={<RoleSelect />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher/register" element={<TeacherRegister />} />
        <Route path="/teacher/classes/:classId" element={<RequireAuth><TeacherClassDetail /></RequireAuth>} />
        <Route
          path="/teacher/classes/:classId/stats"
          element={
            <RequireAuth>
              <TeacherClassStats />
            </RequireAuth>
          }
        />
        <Route path="/teacher/classes/:classId/topics/:topicId" element={<TeacherTopicDetail />} />
        <Route
          path="/teacher/classes/:classId/topics/:topicId/stats"
          element={
            <RequireAuth>
              <TeacherTopicQuizStats />
            </RequireAuth>
          }
        />

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
        <Route path="/student/classes/:classId/topics/:topicId" element={<StudentTopicDetail />} />
        <Route
          path="/student/classes/:classId/topics/:topicId/quiz"
          element={<StudentQuizSession quizVariant="main" />}
        />
        <Route
          path="/student/classes/:classId/topics/:topicId/bonus-quiz"
          element={<StudentQuizSession quizVariant="bonus" />}
        />
        <Route
          path="/student/classes/:classId/topics/:topicId/quiz/results/:attemptId"
          element={<StudentQuizResults />}
        />

      </Routes>
    </BrowserRouter>
  );
}
