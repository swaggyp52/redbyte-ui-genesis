import { HashRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-rb-bg text-rb-text flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/install" element={<Install />} />
            <Route path="/instructors" element={<Instructors />} />
            <Route path="/getting-started" element={<GettingStarted />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/examples" element={<Examples />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/guide/walkthrough" element={<Walkthrough />} />
            <Route path="/manual" element={<ManualRedirect />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
