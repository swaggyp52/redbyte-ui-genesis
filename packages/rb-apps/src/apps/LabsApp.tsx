// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { RedByteApp } from '../types';
import { Icon } from '@redbyte/rb-icons';
import { LAB_DEFINITIONS, type LabDefinition } from '../labs/labDefinitions';
import { LAB_STARTER_KITS } from '../starterKits/labStarterKits';
import type { ExampleId } from '../examples';
import styles from './LabsApp.module.css';

interface LabsAppProps {
        onOpenApp?: (id: string, props?: Record<string, unknown>) => void;
        onOpenStarterProject?: (starter: {
            exampleId: ExampleId;
            targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace';
            starterId?: string;
            instructions?: {
                labId: string;
                title: string;
                timeEstimate: string;
                learningGoal: string;
                steps: string[];
                commonMistakes: string[];
                submit: string[];
                rubric: string[];
            };
        }) => void | Promise<void>;
}

function deriveDifficulty(lab: LabDefinition): 'Beginner' | 'Intermediate' | 'Advanced' {
    const estimate = lab.timeEstimate.toLowerCase();
    if (estimate.includes('30-45') || estimate.includes('45-65')) return 'Beginner';
    if (estimate.includes('50-70') || estimate.includes('55-75') || estimate.includes('60-80')) return 'Intermediate';
    return 'Advanced';
}

function getBoardLabel(lab: LabDefinition): string {
    return lab.basys3Required ? 'Basys3' : 'Simulation-first';
}

const LabsAppComponent: React.FC<LabsAppProps> = ({ onOpenApp, onOpenStarterProject }) => {
    const labs = React.useMemo(
        () => LAB_DEFINITIONS.filter((lab) => lab.id !== 'freeplay'),
        [],
    );

    const handleOpenLab = React.useCallback((lab: LabDefinition) => {
        const starter = LAB_STARTER_KITS.find((kit) => kit.labId === lab.id);
        if (starter?.exampleId && onOpenStarterProject) {
            void onOpenStarterProject({
                exampleId: starter.exampleId,
                targetAppId: 'lab-workspace',
                starterId: starter.id,
                instructions: starter.instructions,
            });
            return;
        }

        onOpenApp?.('lab-workspace', {
            starterInstructions: {
                labId: lab.id,
                title: lab.title,
                timeEstimate: lab.timeEstimate,
                learningGoal: lab.learningGoal,
                steps: lab.buildSteps,
                commonMistakes: lab.commonMistakes,
                submit: lab.submitEvidence,
                rubric: lab.rubric,
            },
        });
    }, [onOpenApp, onOpenStarterProject]);

    return (
        <div className={styles.container} data-testid="labs-surface">
            <div className={styles.inner}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Labs</h1>
                    <p className={styles.subtitle}>One flagship workflow for Labs 1–8: Design → Simulate → Hardware (optional) → Submit.</p>
                </header>

                <div className={styles.grid}>
                    {labs.map((lab) => {
                        const difficulty = deriveDifficulty(lab);
                        const board = getBoardLabel(lab);
                        return (
                            <article key={lab.id} className={styles.card} data-testid={`labs-card-${lab.id}`}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardBadge}>
                                        <Icon name="book" size={16} />
                                        <span>{lab.id.toUpperCase()}</span>
                                    </div>
                                    <div className={styles.cardMeta}>
                                        <span className={styles.pill}>{board}</span>
                                        <span className={styles.pill}>{difficulty}</span>
                                    </div>
                                </div>
                                <h2 className={styles.cardTitle}>{lab.title}</h2>
                                <p className={styles.cardObjective}><strong>Objective:</strong> {lab.learningGoal}</p>
                                <p className={styles.cardTask}><strong>Start with:</strong> {lab.whatToDo}</p>
                                <button
                                    type="button"
                                    className={styles.startButton}
                                    onClick={() => handleOpenLab(lab)}
                                    data-testid={`labs-start-${lab.id}`}
                                >
                                    Start
                                </button>
                            </article>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const LabsApp: RedByteApp = {
    manifest: {
        id: 'labs',
        name: 'Labs',
        iconId: 'book',
        category: 'logic',
        description: 'Central hub for lab workflows in flagship RedByte.',
        defaultSize: { width: 980, height: 700 },
        singleton: true,
    },
    component: LabsAppComponent,
};
