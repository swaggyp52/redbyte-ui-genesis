import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsx(Router, { children: _jsxs("div", { className: "min-h-screen bg-rb-bg text-rb-text flex flex-col", children: [_jsx(Header, {}), _jsx("main", { className: "flex-1", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/product", element: _jsx(About, {}) }), _jsx(Route, { path: "/labs", element: _jsx(Examples, {}) }), _jsx(Route, { path: "/docs", element: _jsx(Guide, {}) }), _jsx(Route, { path: "/download", element: _jsx(Install, {}) }), _jsx(Route, { path: "/students", element: _jsx(StudentStart, {}) }), _jsx(Route, { path: "/lab-0", element: _jsx(LabZero, {}) }), _jsx(Route, { path: "/install", element: _jsx(Install, {}) }), _jsx(Route, { path: "/instructors", element: _jsx(Instructors, {}) }), _jsx(Route, { path: "/getting-started", element: _jsx(GettingStarted, {}) }), _jsx(Route, { path: "/demo", element: _jsx(Demo, {}) }), _jsx(Route, { path: "/examples", element: _jsx(Examples, {}) }), _jsx(Route, { path: "/guide", element: _jsx(Guide, {}) }), _jsx(Route, { path: "/guide/walkthrough", element: _jsx(Walkthrough, {}) }), _jsx(Route, { path: "/manual", element: _jsx(ManualRedirect, {}) }), _jsx(Route, { path: "/about", element: _jsx(About, {}) }), _jsx(Route, { path: "*", element: _jsxs("div", { className: "flex flex-col items-center justify-center min-h-[50vh] text-zinc-400", children: [_jsx("h1", { className: "text-4xl font-bold text-white mb-4", children: "404" }), _jsx("p", { className: "mb-8", children: "Page not found." }), _jsx(Link, { to: "/", className: "text-blue-400 hover:text-blue-300", children: "Return Home" })] }) })] }) }), _jsx(Footer, {})] }) }));
}
export default App;
