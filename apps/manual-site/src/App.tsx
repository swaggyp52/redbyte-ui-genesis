import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import GettingStarted from './pages/GettingStarted';
import Install from './pages/Install';
import Instructors from './pages/Instructors';
import Examples from './pages/Examples';
import Guide from './pages/Manual';
import Walkthrough from './pages/Walkthrough';
import ManualRedirect from './pages/ManualRedirect';
import About from './pages/About';
import Demo from './pages/Demo';
import StudentStart from './pages/StudentStart';
import LabZero from './pages/LabZero';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-rb-bg text-rb-text flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product" element={<About />} />
            <Route path="/labs" element={<Examples />} />
            <Route path="/docs" element={<Guide />} />
            <Route path="/download" element={<Install />} />

            {/* Legacy/Aliases */}
            <Route path="/students" element={<StudentStart />} />
            <Route path="/lab-0" element={<LabZero />} />
            <Route path="/install" element={<Install />} />
            <Route path="/instructors" element={<Instructors />} />
            <Route path="/getting-started" element={<GettingStarted />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/examples" element={<Examples />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/guide/walkthrough" element={<Walkthrough />} />
            <Route path="/manual" element={<ManualRedirect />} />
            <Route path="/about" element={<About />} />

            {/* 404 Fallback */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400">
                <h1 className="text-4xl font-bold text-white mb-4">404</h1>
                <p className="mb-8">Page not found.</p>
                <Link to="/" className="text-blue-400 hover:text-blue-300">Return Home</Link>
              </div>
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
