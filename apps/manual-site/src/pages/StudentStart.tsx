import { Link } from 'react-router-dom';

export default function StudentStart() {
    return (
        <div className="py-16 bg-rb-bg min-h-screen">
            <div className="content-container px-6 max-w-4xl mx-auto">

                {/* Phase A/B: The Canonical Entry Point */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-black text-rb-text mb-6">Student Lab Environment</h1>
                    <p className="text-xl text-rb-muted mb-8 max-w-2xl mx-auto">
                        This is the official RedByte OS environment for your Digital Logic course.
                        You will use this to complete labs, verifying your circuits on real hardware.
                    </p>

                    <div className="flex gap-4 justify-center">
                        <Link
                            to="/lab-0"
                            className="px-8 py-4 bg-rb-accent hover:bg-rb-accent/90 text-rb-bg font-bold rounded-lg text-lg transition-all shadow-lg shadow-rb-accent/20"
                        >
                            Start Lab 0 (Required)
                        </Link>
                        <a
                            href="https://redbyte.os/demo"
                            className="px-8 py-4 bg-rb-surface hover:bg-rb-surface/80 text-rb-text font-bold rounded-lg text-lg border border-rb-border transition-all"
                        >
                            What is this?
                        </a>
                    </div>
                </div>

                {/* Phase C: Access Model */}
                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    <div className="bg-rb-surface border border-rb-border rounded-xl p-8">
                        <div className="mb-4 text-3xl">🌐</div>
                        <h2 className="text-2xl font-bold text-rb-text mb-2">Browser Mode</h2>
                        <p className="text-rb-muted mb-6">
                            Instant access. No installation required. Perfect for viewing labs and simulating logic.
                        </p>
                        <ul className="space-y-2 mb-8 text-sm text-rb-muted">
                            <li>✅ Build Circuits</li>
                            <li>✅ Simulate Logic</li>
                            <li>❌ Hardware Connection (Requires Bridge)</li>
                        </ul>
                        <a href="https://app.redbyte.os" className="text-rb-accent font-bold hover:underline">
                            Launch in Browser &rarr;
                        </a>
                    </div>

                    <div className="bg-rb-surface border border-rb-border rounded-xl p-8">
                        <div className="mb-4 text-3xl">💻</div>
                        <h2 className="text-2xl font-bold text-rb-text mb-2">Local Desktop</h2>
                        <p className="text-rb-muted mb-6">
                            Full power. Connect to FPGA hardware. Required for Lab 1+.
                        </p>
                        <ul className="space-y-2 mb-8 text-sm text-rb-muted">
                            <li>✅ Build Circuits</li>
                            <li>✅ Simulate Logic</li>
                            <li>✅ Hardware Connection (USB)</li>
                        </ul>
                        <Link to="/install" className="text-rb-accent font-bold hover:underline">
                            Download Installer &rarr;
                        </Link>
                    </div>
                </div>

                {/* Phase D: First Launch Expectation */}
                <div className="border-t border-rb-border pt-16">
                    <h2 className="text-3xl font-bold text-rb-text mb-8 text-center">Your First Week</h2>
                    <div className="space-y-6">
                        <Step
                            number={1}
                            title="Launch RedByte"
                            desc="Open the app. You will see a 'Start Here' screen auto-launch."
                        />
                        <Step
                            number={2}
                            title="Complete Lab 0"
                            desc="A 5-minute guided tour to verify your setup. You will export a proof file."
                        />
                        <Step
                            number={3}
                            title="Submit Evidence"
                            desc="Upload your .rb-lab.zip file to your course LMS (Canvas/Blackboard)."
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}

function Step({ number, title, desc }: { number: number, title: string, desc: string }) {
    return (
        <div className="flex gap-6 items-start">
            <div className="w-10 h-10 rounded-full bg-rb-surface border border-rb-border flex items-center justify-center font-bold text-rb-text flex-shrink-0">
                {number}
            </div>
            <div>
                <h3 className="text-xl font-bold text-rb-text mb-1">{title}</h3>
                <p className="text-rb-muted">{desc}</p>
            </div>
        </div>
    );
}
