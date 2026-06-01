import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Success from './pages/Success';
import ErrorPage from './pages/Error';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/success" element={<Success />} />
      <Route path="/error" element={<ErrorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
