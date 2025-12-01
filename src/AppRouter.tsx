import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing/Landing';
import Boot from './pages/Boot';
import Desktop from './Desktop';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Landing />} />
        <Route path='/boot' element={<Boot />} />
        <Route path='/os/*' element={<Desktop />} />
      </Routes>
    </BrowserRouter>
  );
}
