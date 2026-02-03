import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Lab Examiner App
 *
 * UI for instructors to upload student .rb-lab.zip submissions,
 * view grades, and inspect proof artifacts.
 *
 * Calls local ops server for grading (no logic in browser).
 */
import React, { useState, useRef } from 'react';
import styles from './LabExaminerApp.module.css';
const OPS_SERVER = 'http://127.0.0.1:3001';
const LabExaminerApp = () => {
    const [tab, setTab] = useState('upload');
    const [serverStatus, setServerStatus] = useState('checking');
    const [gradeData, setGradeData] = useState(null);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const dragZoneRef = useRef(null);
    // Check server status on mount
    React.useEffect(() => {
        const checkServer = async () => {
            try {
                const response = await fetch(`${OPS_SERVER}/health`, { mode: 'no-cors' });
                setServerStatus('ready');
            }
            catch {
                setServerStatus('offline');
            }
        };
        checkServer();
    }, []);
    // Load runs list
    React.useEffect(() => {
        if (tab === 'runs' && serverStatus === 'ready') {
            loadRuns();
        }
    }, [tab, serverStatus]);
    const loadRuns = async () => {
        try {
            const response = await fetch(`${OPS_SERVER}/api/labs/runs`);
            if (!response.ok)
                throw new Error('Failed to load runs');
            const data = await response.json();
            setRuns(data || []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load runs');
        }
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragZoneRef.current) {
            dragZoneRef.current.classList.add(styles.dragging);
        }
    };
    const handleDragLeave = () => {
        if (dragZoneRef.current) {
            dragZoneRef.current.classList.remove(styles.dragging);
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragZoneRef.current) {
            dragZoneRef.current.classList.remove(styles.dragging);
        }
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };
    const handleFileSelect = async (file) => {
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.rb-lab.zip')) {
            setError('Only .zip and .rb-lab.zip files are accepted');
            return;
        }
        setLoading(true);
        setError(null);
        setGradeData(null);
        try {
            const formData = new FormData();
            formData.append('submission', file);
            const response = await fetch(`${OPS_SERVER}/api/labs/ingest`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Upload failed');
            }
            const result = await response.json();
            setGradeData(result);
            setTab('grade');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        }
        finally {
            setLoading(false);
        }
    };
    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    };
    const loadRunDetail = async (runId) => {
        try {
            const response = await fetch(`${OPS_SERVER}/api/labs/runs/${runId}`);
            if (!response.ok)
                throw new Error('Failed to load run');
            const data = await response.json();
            setGradeData(data);
            setTab('grade');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load run');
        }
    };
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { children: "Lab Examiner" }), _jsxs("div", { className: styles.status, children: [serverStatus === 'ready' && _jsx("span", { className: styles.statusBadge, children: "Server Ready" }), serverStatus === 'offline' && (_jsx("span", { className: styles.statusBadge + ' ' + styles.error, children: "Server Offline (Start with: pnpm ops:server)" }))] })] }), error && _jsx("div", { className: styles.alert + ' ' + styles.error, children: error }), _jsxs("div", { className: styles.tabs, children: [_jsx("button", { className: tab === 'upload' ? styles.tabActive : '', onClick: () => setTab('upload'), children: "Upload" }), gradeData && (_jsx("button", { className: tab === 'grade' ? styles.tabActive : '', onClick: () => setTab('grade'), children: "Grade" })), _jsx("button", { className: tab === 'runs' ? styles.tabActive : '', onClick: () => setTab('runs'), children: "Runs" })] }), tab === 'upload' && (_jsx("div", { className: styles.tabContent, children: serverStatus === 'offline' ? (_jsxs("div", { className: styles.alert + ' ' + styles.error, children: [_jsx("h3", { children: "Ops Server Offline" }), _jsx("p", { children: "Start the local server first:" }), _jsx("code", { children: "pnpm ops:server" })] })) : (_jsxs("div", { children: [_jsx("div", { ref: dragZoneRef, className: styles.dragZone, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, children: _jsxs("div", { className: styles.dragZoneContent, children: [_jsx("p", { className: styles.dragZoneText, children: "Drag and drop .rb-lab.zip here" }), _jsx("p", { className: styles.dragZoneSmall, children: "or" }), _jsx("button", { className: styles.button, onClick: () => fileInputRef.current?.click(), disabled: loading, children: loading ? 'Processing...' : 'Select File' })] }) }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".zip,.rb-lab.zip", onChange: handleFileInputChange, style: { display: 'none' }, title: "Select .rb-lab.zip submission file" })] })) })), tab === 'grade' && gradeData && (_jsxs("div", { className: styles.tabContent, children: [_jsxs("div", { className: styles.gradeHeader, children: [_jsx("h2", { children: "Grade Summary" }), _jsx("div", { className: styles.verdictBadge + ' ' + (gradeData.verdict === 'PASS' ? styles.pass : gradeData.verdict === 'FAIL' ? styles.fail : styles.invalid), children: gradeData.verdict })] }), _jsxs("div", { className: styles.metadata, children: [_jsxs("div", { className: styles.metadataItem, children: [_jsx("strong", { children: "Lab:" }), " ", gradeData.lab_id] }), _jsxs("div", { className: styles.metadataItem, children: [_jsx("strong", { children: "Student:" }), " ", gradeData.student_id] }), _jsxs("div", { className: styles.metadataItem, children: [_jsx("strong", { children: "Run ID:" }), " ", gradeData.run_id] }), _jsxs("div", { className: styles.metadataItem, children: [_jsx("strong", { children: "Timestamp:" }), " ", new Date(gradeData.timestamp).toLocaleString()] })] }), _jsxs("div", { className: styles.markdownContent, children: [_jsx("h3", { children: "Details" }), _jsx("div", { className: styles.markdown, children: gradeData.grade_md.split('\n').map((line, i) => (_jsx("div", { children: line }, i))) })] })] })), tab === 'runs' && (_jsxs("div", { className: styles.tabContent, children: [_jsx("h2", { children: "Recent Runs" }), runs.length === 0 ? (_jsx("p", { className: styles.empty, children: "No runs yet." })) : (_jsx("div", { className: styles.runsList, children: runs.map((run) => (_jsxs("div", { className: styles.runItem, children: [_jsxs("div", { className: styles.runInfo, children: [_jsx("div", { className: styles.runId, children: run.run_id }), _jsx("div", { className: styles.runTimestamp, children: new Date(run.timestamp).toLocaleString() })] }), _jsx("div", { className: styles.runVerdict + ' ' + (run.verdict === 'PASS' ? styles.pass : run.verdict === 'FAIL' ? styles.fail : styles.invalid), children: run.verdict }), _jsx("button", { className: styles.buttonSmall, onClick: () => loadRunDetail(run.run_id), children: "View" })] }, run.run_id))) }))] }))] }));
};
export default LabExaminerApp;
