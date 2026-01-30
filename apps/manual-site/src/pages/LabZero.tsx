import { Link } from 'react-router-dom';

export default function LabZero() {
    return (
        <div className="py-16 bg-rb-bg min-h-screen">
            <div className="content-container px-6 max-w-3xl mx-auto">
                <Link to="/students" className="text-rb-muted hover:text-rb-text mb-8 block">&larr; Back to Student Hub</Link>

                <h1 className="text-4xl font-black text-rb-text mb-4">Lab 0: System Check</h1>
                <p className="text-xl text-rb-muted mb-12">
                    Verify your RedByte environment allows you to build, simulate, and export evidence.
                    This assignment is graded on **completion**.
                </p>

                <section className="space-y-12">
                    <div className="prose prose-invert max-w-none">
                        <h3>Objective</h3>
                        <p>Create a simple "AND Gate" circuit and export the verified evidence file.</p>
                    </div>

                    <Step
                        num={1}
                        title="Launch the Interactive Lab"
                        content={
                            <>
                                <p>Open RedByte OS. On the <strong>Start Here</strong> window, click <strong>"Lab Assignment"</strong>.</p>
                                <div className="bg-rb-surface p-4 rounded border border-rb-border text-sm text-rb-muted mt-2">
                                    <em>Note: This automatically loads the "Intro to Digital Logic" lab environment.</em>
                                </div>
                            </>
                        }
                    />

                    <Step
                        num={2}
                        title="Build the Circuit"
                        content={
                            <>
                                <p>Follow the on-screen guide (left panel):</p>
                                <ul className="list-disc pl-6 space-y-2 mt-2">
                                    <li>Drag 2 <strong>Switches</strong> from the palette.</li>
                                    <li>Drag 1 <strong>AND Gate</strong>.</li>
                                    <li>Drag 1 <strong>LED</strong>.</li>
                                    <li>Wire them together (Switch &rarr; Gate &rarr; LED).</li>
                                </ul>
                            </>
                        }
                    />

                    <Step
                        num={3}
                        title="Verify & Simulate"
                        content={
                            <>
                                <p>Press <strong>Spacebar</strong> to start simulation.</p>
                                <p>Toggle the switches. The LED should only light up when <strong>BOTH</strong> switches are ON.</p>
                            </>
                        }
                    />

                    <Step
                        num={4}
                        title="Export Evidence"
                        content={
                            <>
                                <p>Click the <strong>"Export Evidence"</strong> button in the top right.</p>
                                <p>Save the file as <code>LastName_Lab0.rb-lab.zip</code>.</p>
                                <p className="text-rb-accent font-bold mt-2">This is your submission file.</p>
                            </>
                        }
                    />

                    <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl">
                        <h3 className="text-green-400 font-bold mb-2">Submission</h3>
                        <p className="text-rb-muted">
                            Upload <code>.rb-lab.zip</code> to your course LMS. You do not need to take screenshots.
                            The file contains your circuit, simulation logs, and verification hash.
                        </p>
                    </div>

                </section>
            </div>
        </div>
    );
}

function Step({ num, title, content }: { num: number, title: string, content: React.ReactNode }) {
    return (
        <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-rb-surface border border-rb-border rounded-xl flex items-center justify-center font-black text-xl text-rb-text">
                {num}
            </div>
            <div>
                <h3 className="text-2xl font-bold text-rb-text mb-4">{title}</h3>
                <div className="text-rb-muted leading-relaxed space-y-2">
                    {content}
                </div>
            </div>
        </div>
    );
}
