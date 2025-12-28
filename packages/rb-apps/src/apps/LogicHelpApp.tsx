import React, { useState } from 'react';
import type { RedByteApp } from '../types';
import type { Intent } from '@redbyte/rb-shell';
import { triggerNarrative } from '@redbyte/rb-shell';
import { OpenExampleButton } from '../components/OpenExampleButton';
import {
  HelpLayout,
  HelpSidebar,
  HelpSection,
  Callout,
  TruthTable,
  LessonNav,
  type Track,
  type Lesson,
} from '../components/help';

/**
 * Logic Help App - Educational curriculum for learning digital logic
 *
 * Provides structured learning content through three tracks:
 * - Track A: Introduction to Logic (Gates & Truth Tables)
 * - Track B: Intermediate Logic (Muxes & Adders)
 * - Track C: Sequential Logic (FSMs, Registers, CPUs)
 */

type TrackId = 'A' | 'B' | 'C';

interface LogicHelpProps {
  onDispatchIntent?: (intent: Intent) => void;
}

const LogicHelpComponent: React.FC<LogicHelpProps> = ({ onDispatchIntent }) => {
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  // Track definitions
  const tracks: Record<TrackId, Track & { lessons: Lesson[] }> = {
    A: {
      id: 'A',
      title: 'Track A: Introduction to Logic',
      description: 'Learn the fundamentals of binary logic, truth values, and basic gates',
      lessons: [
        {
          id: 'A1',
          title: 'Hello, Circuit!',
        },
        {
          id: 'A2',
          title: 'Manual Control (Switches)',
        },
        {
          id: 'A3',
          title: 'NOT Gate - The Inverter',
        },
        {
          id: 'A4',
          title: 'AND Gate - Both Required',
        },
        {
          id: 'A5',
          title: 'OR Gate - Either Works',
        },
        {
          id: 'A6',
          title: 'Truth Tables - The Gate Contract',
        },
        {
          id: 'A7',
          title: 'NAND & NOR - Universal Gates',
        },
        {
          id: 'A8',
          title: 'Track A Complete!',
        },
      ],
    },
    B: {
      id: 'B',
      title: 'Track B: Intermediate Logic',
      description: 'Build more complex circuits with XOR, muxes, and adders',
      lessons: [
        {
          id: 'B1',
          title: 'XOR - Exclusive OR',
        },
        {
          id: 'B2',
          title: 'Half Adder - Adding 1-bit Numbers',
        },
        {
          id: 'B3',
          title: 'Full Adder - Ripple Carry',
        },
        {
          id: 'B4',
          title: 'Multiplexer (Mux) - Data Selector',
        },
        {
          id: 'B5',
          title: 'Demultiplexer - Data Router',
        },
        {
          id: 'B6',
          title: 'Track B Complete!',
        },
      ],
    },
    C: {
      id: 'C',
      title: 'Track C: Sequential Logic',
      description: 'Master memory, state machines, and CPU fundamentals',
      lessons: [
        {
          id: 'C1',
          title: 'The Need for Memory',
        },
        {
          id: 'C2',
          title: 'SR Latch - Basic Memory Cell',
        },
        {
          id: 'C3',
          title: 'D Latch - Controlled Memory',
        },
        {
          id: 'C4',
          title: 'D Flip-Flop - Edge-Triggered Memory',
        },
        {
          id: 'C5',
          title: 'Registers & Counters',
        },
        {
          id: 'C6',
          title: 'Finite State Machines',
        },
        {
          id: 'C7',
          title: 'Simple CPU - Bringing It All Together',
        },
        {
          id: 'C8',
          title: 'Reflection & The Journey Forward',
        },
      ],
    },
  };

  // Lesson content renderer
  const renderLessonContent = (trackId: TrackId, lessonId: string) => {
    // A1: Hello, Circuit!
    if (lessonId === 'A1') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              A circuit needs a complete path for electricity to flow. When power connects to a component like a lamp,
              electrons flow through it.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Logic Playground (if not already open)</li>
              <li>
                Find the <strong>Power</strong> source in the component palette
              </li>
              <li>
                Find the <strong>Lamp</strong> component
              </li>
              <li>Connect the Power to the Lamp by dragging a wire</li>
            </ol>
          </HelpSection>

          <HelpSection kind="simulate">
            <p>
              <strong>What happens?</strong> The lamp lights up immediately! You've created a closed circuit.
            </p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>Closed Circuit:</strong> When components form a complete path from power source back to ground,
              electricity flows and the lamp turns on.
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: What would happen if you disconnected the wire? (The lamp would turn off because the circuit is
              broken!)
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A2: Manual Control (Switches)
    if (lessonId === 'A2') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              A switch lets you control the flow of electricity. Digital logic uses two states: <strong>1</strong> (ON,
              TRUE) and <strong>0</strong> (OFF, FALSE).
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a new circuit (or clear the previous one)</li>
              <li>
                Add a <strong>Switch</strong> component
              </li>
              <li>Connect: Power → Switch → Lamp</li>
            </ol>
          </HelpSection>

          <HelpSection kind="simulate">
            <ol className="list-decimal list-inside space-y-1">
              <li>Click the switch to turn it ON (1) - observe the lamp lights up</li>
              <li>Click again to turn it OFF (0) - observe the lamp goes dark</li>
              <li>Toggle it several times to see the immediate response</li>
            </ol>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>Binary States:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <strong>1 (ON):</strong> Switch closed, electricity flows, lamp lights
                </li>
                <li>
                  <strong>0 (OFF):</strong> Switch open, no flow, lamp is dark
                </li>
              </ul>
              <p className="mt-2">This on/off concept is the foundation of all digital computing!</p>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: In your computer's processor right now, billions of tiny switches are turning on and off to run
              this program.
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A3: NOT Gate
    if (lessonId === 'A3') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              The <strong>NOT gate</strong> (also called an inverter) flips the input. If you give it 1, it outputs 0.
              If you give it 0, it outputs 1.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Place a <strong>NOT</strong> gate on your canvas
              </li>
              <li>Connect a switch to the input</li>
              <li>Connect a lamp to the output</li>
            </ol>
          </HelpSection>

          <HelpSection kind="simulate">
            <TruthTable headers={['Input', 'Output']} rows={[[0, 1], [1, 0]]} />
            <p className="mt-2 text-sm">Toggle the switch and confirm the lamp does the opposite.</p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>Why NOT Matters:</strong>
              <p className="mt-2">
                Inversion is everywhere in computing. Conditional logic ("if NOT raining"), password validation ("if
                NOT correct"), boolean algebra – all rely on the ability to flip a signal.
              </p>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: You just used a gate for the first time! Gates are the building blocks of all computation.
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A4: AND Gate
    if (lessonId === 'A4') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              The <strong>AND gate</strong> outputs 1 only when <em>both</em> inputs are 1. If either input is 0, the
              output is 0.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Place an <strong>AND</strong> gate
              </li>
              <li>Connect two switches to the inputs</li>
              <li>Connect a lamp to the output</li>
            </ol>
          </HelpSection>

          <HelpSection kind="simulate">
            <TruthTable headers={['A', 'B', 'Output']} rows={[[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]]} highlightedCells={new Set(['3-2'])} />
            <p className="mt-2 text-sm">
              Only when <strong>both A=1 AND B=1</strong> does the lamp light.
            </p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>AND in Real Life:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Alarm systems: Motion detected AND door open → sound alarm</li>
                <li>Cars: Brake pressed AND gear in drive → brake lights on</li>
                <li>Permissions: User logged in AND has admin rights → allow action</li>
              </ul>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: How many AND decisions does your brain make every day? "If hungry AND food available, eat."
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A5: OR Gate
    if (lessonId === 'A5') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              The <strong>OR gate</strong> outputs 1 if <em>either</em> input (or both) is 1. It only outputs 0 when
              both inputs are 0.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Place an <strong>OR</strong> gate
              </li>
              <li>Connect two switches to the inputs</li>
              <li>Connect a lamp to the output</li>
            </ol>
          </HelpSection>

          <HelpSection kind="simulate">
            <TruthTable headers={['A', 'B', 'Output']} rows={[[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]]} highlightedCells={new Set(['1-2', '2-2', '3-2'])} />
            <p className="mt-2 text-sm">
              The lamp lights if <strong>A=1 OR B=1 OR both</strong>.
            </p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>OR in Real Life:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Doors: Front sensor triggered OR back sensor triggered → open door</li>
                <li>Alerts: Battery low OR temperature high → send notification</li>
                <li>Search: Results matching keyword A OR keyword B</li>
              </ul>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: OR gives you options. It's the foundation of choice in computing.
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A6: Truth Tables
    if (lessonId === 'A6') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              A <strong>truth table</strong> is a contract. It lists every possible input combination and the
              guaranteed output. Once you know a gate's truth table, you know exactly how it behaves.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-2">NOT Gate:</p>
                <TruthTable headers={['Input', 'Output']} rows={[[0, 1], [1, 0]]} />
              </div>

              <div>
                <p className="font-semibold mb-2">AND Gate:</p>
                <TruthTable headers={['A', 'B', 'Output']} rows={[[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]]} />
              </div>

              <div>
                <p className="font-semibold mb-2">OR Gate:</p>
                <TruthTable headers={['A', 'B', 'Output']} rows={[[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]]} />
              </div>
            </div>
          </HelpSection>

          <HelpSection kind="simulate">
            <p>Build each gate and verify the truth table yourself. Toggle all combinations!</p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>Why Truth Tables Matter:</strong>
              <p className="mt-2">
                Truth tables are the spec. When hardware engineers design chips, they define behavior with truth
                tables. When software engineers write tests, they're essentially checking truth tables. They're the
                universal language of logic.
              </p>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: You now speak the language that connects math, hardware, and software.
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A7: NAND & NOR
    if (lessonId === 'A7') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              <strong>NAND</strong> (NOT-AND) and <strong>NOR</strong> (NOT-OR) are called <em>universal gates</em>{' '}
              because you can build ANY other gate using only NAND or only NOR.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-2">NAND Gate (NOT-AND):</p>
                <TruthTable headers={['A', 'B', 'Output']} rows={[[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]]} />
              </div>

              <div>
                <p className="font-semibold mb-2">NOR Gate (NOT-OR):</p>
                <TruthTable headers={['A', 'B', 'Output']} rows={[[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]]} />
              </div>
            </div>
          </HelpSection>

          <HelpSection kind="simulate">
            <p>Challenge: Build a NOT gate using only a NAND gate!</p>
            <p className="text-sm text-gray-400 mt-2">(Hint: Connect both NAND inputs to the same source)</p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>Why Universal Gates Matter:</strong>
              <p className="mt-2">
                Real computer chips are often built entirely from NAND gates because they're simple to manufacture. The
                entire processor in your computer could theoretically be built from billions of NAND gates.
              </p>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: The simplest building block can create infinite complexity.
            </Callout>
          </HelpSection>
        </>
      );
    }

    // A8: Track A Complete
    if (lessonId === 'A8') {
      return (
        <>
          <div className="text-center py-12">
            <h2 className="text-3xl mb-4 text-cyan-400">🎉 Track A Complete! 🎉</h2>
            <p className="text-xl text-gray-200 mb-6">You've mastered the fundamentals of digital logic!</p>
          </div>

          <HelpSection kind="concept">
            <p>You now understand:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Binary states (0 and 1)</li>
              <li>Basic logic gates (NOT, AND, OR, NAND, NOR)</li>
              <li>Truth tables as the contract of gate behavior</li>
              <li>How gates combine to create more complex logic</li>
            </ul>
          </HelpSection>

          <HelpSection kind="build">
            <Callout variant="success">
              <p className="font-semibold">What's Next?</p>
              <p className="mt-2">
                <strong>Track B: Intermediate Logic</strong> - Build XOR gates, half adders, full adders, and
                multiplexers. Learn how computers perform arithmetic!
              </p>
              <p className="mt-2">
                <strong>Track C: Sequential Logic</strong> - Master memory, state machines, and CPU architecture.
                Understand how computers remember and execute programs!
              </p>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              You've laid the foundation. Every complex circuit you'll ever see is built from these simple gates. Ready
              for more?
            </Callout>
          </HelpSection>
        </>
      );
    }

    // B1: XOR Gate
    if (lessonId === 'B1') {
      return (
        <>
          <HelpSection kind="concept">
            <p>
              <strong>XOR (Exclusive OR)</strong> outputs 1 when inputs are <em>different</em>. Unlike regular OR, XOR
              outputs 0 when both inputs are 1.
            </p>
          </HelpSection>

          <HelpSection kind="build">
            <p>
              Build an XOR using basic gates: <code>(A AND NOT B) OR (NOT A AND B)</code>
            </p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>Use two AND gates, two NOT gates, and one OR gate</li>
              <li>Connect two switches to inputs A and B</li>
              <li>Connect a lamp to the final output</li>
            </ol>
          </HelpSection>

          <HelpSection kind="simulate">
            <TruthTable
              headers={['A', 'B', 'A XOR B']}
              rows={[[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]]}
              highlightedCells={new Set(['1-2', '2-2'])}
            />
            <p className="mt-2 text-sm">Output is 1 only when inputs differ.</p>
          </HelpSection>

          <HelpSection kind="explain">
            <Callout>
              <strong>Why XOR Matters:</strong>
              <p className="mt-2">
                XOR is crucial for binary addition – it gives you the sum bit! When you add 1+1 in binary, you get 10
                (sum=0, carry=1). That sum bit is exactly what XOR produces.
              </p>
            </Callout>
          </HelpSection>

          <HelpSection kind="reflect">
            <Callout variant="reflect">
              Think: You just built a new gate from simpler parts. This is exactly how complex circuits are designed –
              layer by layer, building blocks on top of blocks.
            </Callout>
          </HelpSection>
        </>
      );
    }

    // Fallback for unimplemented lessons
    return (
      <div className="text-center py-12 text-gray-400">
        <h2 className="text-2xl mb-4">{lessonId}: Content Coming Soon</h2>
        <p>This lesson is being migrated to the new component system.</p>
      </div>
    );
  };

  const currentTrack = selectedTrack ? tracks[selectedTrack] : null;
  const currentLesson = currentTrack?.lessons[currentLessonIndex];

  const handleMarkComplete = () => {
    if (currentLesson) {
      const newCompleted = new Set(completedLessons);
      if (newCompleted.has(currentLesson.id)) {
        newCompleted.delete(currentLesson.id);
      } else {
        newCompleted.add(currentLesson.id);

        // Trigger narrative for first lesson completion
        if (currentLesson.id === 'A1' && newCompleted.size === 1) {
          triggerNarrative('first-lesson-complete');
        }

        // Trigger narrative for track completion
        if (
          currentLesson.id === 'A8' ||
          currentLesson.id === 'B6' ||
          currentLesson.id === 'C8'
        ) {
          triggerNarrative('track-complete');
        }
      }
      setCompletedLessons(newCompleted);
    }
  };

  return (
    <HelpLayout
      sidebar={
        <HelpSidebar
          tracks={!selectedTrack ? Object.values(tracks) : undefined}
          onSelectTrack={(id) => {
            setSelectedTrack(id as TrackId);
            setCurrentLessonIndex(0);
          }}
          selectedTrack={currentTrack}
          lessons={currentTrack?.lessons}
          currentLessonIndex={currentLessonIndex}
          completedLessons={completedLessons}
          onSelectLesson={setCurrentLessonIndex}
          onBackToTracks={() => setSelectedTrack(null)}
        />
      }
    >
      {currentLesson && currentTrack ? (
        <div>
          {/* Lesson Header */}
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-2 truncate">{currentTrack.title}</div>
            <h1 className="text-3xl text-cyan-400 mb-1 break-words">
              {currentLesson.id}: {currentLesson.title}
            </h1>
          </div>

          {/* Lesson Content */}
          <div className="prose prose-invert max-w-none">
            {renderLessonContent(selectedTrack, currentLesson.id)}
          </div>

          {/* Navigation */}
          <LessonNav
            currentIndex={currentLessonIndex}
            totalLessons={currentTrack.lessons.length}
            onPrevious={currentLessonIndex > 0 ? () => setCurrentLessonIndex((i) => i - 1) : undefined}
            onNext={
              currentLessonIndex < currentTrack.lessons.length - 1
                ? () => setCurrentLessonIndex((i) => i + 1)
                : undefined
            }
            onMarkComplete={handleMarkComplete}
            isCompleted={completedLessons.has(currentLesson.id)}
          />
        </div>
      ) : (
        <div className="text-center mt-16 text-gray-400">
          <h2 className="text-2xl mb-4">Welcome to Logic Help!</h2>
          <p>Choose a track from the sidebar to begin your journey.</p>
        </div>
      )}
    </HelpLayout>
  );
};

// Export as RedByteApp
const LogicHelpApp: RedByteApp = {
  manifest: {
    id: 'help',
    name: 'Logic Help',
    iconId: 'book',
    defaultSize: { width: 1000, height: 700 },
    minSize: { width: 700, height: 500 },
  },
  component: LogicHelpComponent,
};

export default LogicHelpApp;
