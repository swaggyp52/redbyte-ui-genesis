import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
import styles from './InstructorRunDetailApp.module.css';
export const InstructorRunDetailAppContent = ({ runId, onNavigate }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    useEffect(() => {
        if (!runId) {
            setError('No run ID provided');
            setLoading(false);
            return;
        }
        fetch(`/api/labs/runs/${runId}`)
            .then((res) => {
            if (!res.ok)
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
            .then((data) => {
            setDetail(data);
            setLoading(false);
        })
            .catch((err) => {
            console.error('Failed to fetch run detail:', err);
            setError(err.message);
            setLoading(false);
        });
    }, [runId]);
    const handleBack = () => {
        onNavigate?.('instructor');
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
    const getResultBadgeClass = (result) => {
        if (result === 'PASS')
            return styles.resultPass;
        if (result === 'FAIL')
            return styles.resultFail;
        return styles.resultUnknown;
    };
    if (loading) {
        return (_jsx("div", { className: styles.container, children: _jsx("div", { className: styles.loading, children: "Loading run details..." }) }));
    }
    if (error || !detail) {
        return (_jsxs("div", { className: styles.container, children: [_jsx("button", { onClick: handleBack, className: styles.backButton, children: "\u2190 Back to Runs" }), _jsxs("div", { className: styles.error, children: [_jsx("strong", { children: "Error:" }), " ", error || 'Run not found'] })] }));
    }
    return (_jsxs("div", { className: styles.container, children: [_jsx("button", { onClick: handleBack, className: styles.backButton, children: "\u2190 Back to Runs" }), _jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.titleRow, children: [_jsxs("h1", { className: styles.title, children: ["Run: ", detail.run_id.slice(0, 12)] }), _jsx("span", { className: getBadgeClass(detail.verdict), children: detail.verdict || 'UNKNOWN' })] }), _jsxs("div", { className: styles.metaRow, children: [_jsxs("div", { className: styles.metaItem, children: [_jsx("span", { className: styles.metaLabel, children: "Student:" }), _jsx("span", { className: styles.metaValue, children: detail.student || '—' })] }), _jsxs("div", { className: styles.metaItem, children: [_jsx("span", { className: styles.metaLabel, children: "Lab:" }), _jsx("span", { className: styles.metaValue, children: detail.lab_name || '—' })] }), _jsxs("div", { className: styles.metaItem, children: [_jsx("span", { className: styles.metaLabel, children: "Time:" }), _jsx("span", { className: styles.metaValue, children: new Date(detail.timestamp).toLocaleString() })] }), _jsxs("div", { className: styles.metaItem, children: [_jsx("span", { className: styles.metaLabel, children: "Exit Code:" }), _jsx("span", { className: styles.metaValue, children: detail.exit_code !== undefined ? detail.exit_code : '—' })] })] })] }), _jsxs("div", { className: styles.tabs, children: [_jsx("button", { className: activeTab === 'summary' ? styles.tabActive : styles.tab, onClick: () => setActiveTab('summary'), children: "Summary" }), _jsxs("button", { className: activeTab === 'vectors' ? styles.tabActive : styles.tab, onClick: () => setActiveTab('vectors'), children: ["Vectors (", detail.results?.length || 0, ")"] }), _jsx("button", { className: activeTab === 'artifacts' ? styles.tabActive : styles.tab, onClick: () => setActiveTab('artifacts'), children: "Artifacts" })] }), _jsxs("div", { className: styles.tabContent, children: [activeTab === 'summary' && (_jsxs("div", { className: styles.summarySection, children: [detail.summary && (_jsxs("div", { className: styles.summaryCards, children: [_jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Passed" }), _jsx("div", { className: styles.summaryValuePass, children: detail.summary.passed || 0 })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Failed" }), _jsx("div", { className: styles.summaryValueFail, children: detail.summary.failed || 0 })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Total" }), _jsx("div", { className: styles.summaryValue, children: detail.summary.total || 0 })] })] })), !detail.summary && (_jsx("div", { className: styles.empty, children: "No summary data available" }))] })), activeTab === 'vectors' && (_jsx("div", { className: styles.vectorsSection, children: detail.results && detail.results.length > 0 ? (_jsx("div", { className: styles.vectorsList, children: detail.results.map((vec, idx) => (_jsxs("div", { className: styles.vectorCard, children: [_jsxs("div", { className: styles.vectorHeader, children: [_jsx("span", { className: styles.vectorName, children: vec.name }), _jsx("span", { className: getResultBadgeClass(vec.result), children: vec.result })] }), vec.inputs && (_jsxs("div", { className: styles.vectorDetail, children: [_jsx("span", { className: styles.vectorLabel, children: "Inputs:" }), _jsx("span", { className: styles.vectorValue, children: Object.entries(vec.inputs).map(([k, v]) => `${k}=${v}`).join(', ') })] })), vec.expected && (_jsxs("div", { className: styles.vectorDetail, children: [_jsx("span", { className: styles.vectorLabel, children: "Expected:" }), _jsx("span", { className: styles.vectorValue, children: vec.expected })] })), vec.observed && (_jsxs("div", { className: styles.vectorDetail, children: [_jsx("span", { className: styles.vectorLabel, children: "Observed:" }), _jsx("span", { className: styles.vectorValue, children: vec.observed })] }))] }, idx))) })) : (_jsx("div", { className: styles.empty, children: "No vector results available" })) })), activeTab === 'artifacts' && (_jsx("div", { className: styles.artifactsSection, children: detail.artifacts && Object.keys(detail.artifacts).length > 0 ? (_jsx("div", { className: styles.artifactsList, children: Object.entries(detail.artifacts).map(([name, url]) => (_jsxs("div", { className: styles.artifactCard, children: [_jsx("span", { className: styles.artifactName, children: name }), _jsx("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: styles.artifactLink, children: "View" })] }, name))) })) : (_jsx("div", { className: styles.empty, children: "No artifacts available" })) }))] })] }));
};
export const InstructorRunDetailApp = {
    manifest: {
        id: 'instructor-run-detail',
        name: 'Run Detail',
        iconId: 'file-text',
        singleton: false,
        defaultSize: {
            width: 800,
            height: 700,
        },
    },
    component: InstructorRunDetailAppContent,
};
