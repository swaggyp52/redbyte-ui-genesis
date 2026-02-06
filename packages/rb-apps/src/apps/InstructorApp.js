import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
import styles from './InstructorApp.module.css';
import { fetchLabRuns } from '../services/opsClient';
export const InstructorAppContent = ({ onNavigate }) => {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        fetchLabRuns()
            .then((data) => {
            setRuns(data);
            setLoading(false);
        })
            .catch((err) => {
            console.error('Failed to fetch runs:', err);
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
        });
    }, []);
    const handleRunClick = (runId) => {
        onNavigate?.('instructor-run-detail', { runId });
    };
    const getBadgeClass = (verdict) => {
        if (verdict === 'PASS')
            return styles.badgePass;
        if (verdict === 'FAIL')
            return styles.badgeFail;
        if (verdict === 'INVALID')
            return styles.badgeInvalid;
        return styles.badgeUnknown;
    };
    if (loading) {
        return (_jsx("div", { className: styles.container, children: _jsx("div", { className: styles.loading, children: "Loading runs..." }) }));
    }
    if (error) {
        return (_jsx("div", { className: styles.container, children: _jsxs("div", { className: styles.error, children: [_jsx("strong", { children: "Error:" }), " ", error] }) }));
    }
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: "Lab Runs" }), _jsxs("p", { className: styles.subtitle, children: [runs.length, " ", runs.length === 1 ? 'submission' : 'submissions', " ingested"] })] }), runs.length === 0 ? (_jsx("div", { className: styles.empty, children: "No lab runs yet. Students must export submissions, then ops must ingest them." })) : (_jsx("div", { className: styles.tableWrapper, children: _jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Time" }), _jsx("th", { children: "Student" }), _jsx("th", { children: "Lab" }), _jsx("th", { children: "Verdict" }), _jsx("th", { children: "Exit Code" }), _jsx("th", { children: "Run ID" })] }) }), _jsx("tbody", { children: runs.map((run) => (_jsxs("tr", { className: styles.row, onClick: () => handleRunClick(run.run_id), "data-testid": `run-row-${run.run_id}`, children: [_jsx("td", { children: run.created_at || run.timestamp ? new Date(run.created_at || run.timestamp).toLocaleString() : '—' }), _jsx("td", { children: run.student_id || '—' }), _jsx("td", { children: run.lab_id || '—' }), _jsx("td", { children: _jsx("span", { className: getBadgeClass(run.verdict), children: run.verdict || '—' }) }), _jsx("td", { children: run.exit_code !== undefined ? run.exit_code : '—' }), _jsx("td", { className: styles.runId, children: run.run_id.slice(0, 8) })] }, run.run_id))) })] }) }))] }));
};
export const InstructorApp = {
    manifest: {
        id: 'instructor',
        name: 'Instructor Dashboard',
        iconId: 'grid',
        singleton: true,
        defaultSize: {
            width: 900,
            height: 600,
        },
    },
    component: InstructorAppContent,
};
