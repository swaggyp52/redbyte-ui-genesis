import React, { useState } from 'react';
import type { RedByteApp } from '../types';
import type { Intent } from '@redbyte/rb-shell';
import { triggerNarrative } from '@redbyte/rb-shell';
import { OpenExampleButton } from '../components/OpenExampleButton';

/**
 * Logic Help App - Educational curriculum for learning digital logic
 *
 * Provides structured learning content through three tracks:
 * - Track A: Introduction to Logic (Gates & Truth Tables)
 * - Track B: Intermediate Logic (Muxes & Adders)
 * - Track C: Sequential Logic (FSMs, Registers, CPUs)
 */

type Track = 'A' | 'B' | 'C';

interface Lesson {
  id: string;
  title: string;
  content: React.ReactNode | ((props: { onDispatchIntent?: (intent: Intent) => void }) => React.ReactNode);
}

interface LogicHelpProps {
  onDispatchIntent?: (intent: Intent) => void;
}

const LogicHelpComponent: React.FC<LogicHelpProps> = ({ onDispatchIntent }) => {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  const tracks = {
    A: {
      title: 'Track A: Introduction to Logic',
      description: 'Learn the fundamentals of binary logic, truth values, and basic gates',
      lessons: [
        {
          id: 'A1',
          title: 'Hello, Circuit!',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A circuit needs a complete path for electricity to flow. When power connects to a component like a lamp, electrons flow through it.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Open Logic Playground (if not already open)</li>
                <li>Find the <strong>Power</strong> source in the component palette</li>
                <li>Find the <strong>Lamp</strong> component</li>
                <li>Connect the Power to the Lamp by dragging a wire</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p><strong>What happens?</strong> The lamp lights up immediately! You've created a closed circuit.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Closed Circuit:</strong> When components form a complete path from power source back to ground,
                electricity flows and the lamp turns on.
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: What would happen if you disconnected the wire? (The lamp would turn off because the circuit is broken!)
              </p>
            </div>
          )
        },
        {
          id: 'A2',
          title: 'Manual Control (Switches)',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A switch lets you control the flow of electricity. Digital logic uses two states: <strong>1</strong> (ON, TRUE) and <strong>0</strong> (OFF, FALSE).</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Create a new circuit (or clear the previous one)</li>
                <li>Add a <strong>Switch</strong> component</li>
                <li>Connect: Power → Switch → Lamp</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <ol>
                <li>Click the switch to turn it ON (1) - observe the lamp lights up</li>
                <li>Click again to turn it OFF (0) - observe the lamp goes dark</li>
                <li>Toggle it several times to see the immediate response</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Binary States:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  <li><strong>1 (ON):</strong> Switch closed, electricity flows, lamp lights</li>
                  <li><strong>0 (OFF):</strong> Switch open, no flow, lamp is dark</li>
                </ul>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  This on/off concept is the foundation of all digital computing!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: Everything in a computer is represented as 1s and 0s. How might you represent numbers or letters using just these two values?
              </p>
            </div>
          )
        },
        {
          id: 'A3',
          title: 'Logic Gates: NOT, AND, OR',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>Logic gates are the building blocks of digital circuits. They make decisions based on their inputs. Let's explore the three most basic gates.</p>

              <hr style={{ border: 'none', borderTop: '1px solid #2d3748', margin: '1.5rem 0' }} />

              <h4 style={{ color: '#4fd1c5' }}>NOT Gate (Inverter)</h4>
              <p><strong>Rule:</strong> Flips the input - 0 becomes 1, 1 becomes 0</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Place a <strong>NOT</strong> gate</li>
                <li>Connect a switch to its input</li>
                <li>Connect a lamp to its output</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1rem', marginBottom: '0.5rem' }}>Simulate & Observe</h3>
              <p>Toggle the switch: When switch is 0, lamp is 1. When switch is 1, lamp is 0!</p>

              <hr style={{ border: 'none', borderTop: '1px solid #2d3748', margin: '1.5rem 0' }} />

              <h4 style={{ color: '#4fd1c5' }}>AND Gate</h4>
              <p><strong>Rule:</strong> Outputs 1 ONLY when BOTH inputs are 1</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Place an <strong>AND</strong> gate</li>
                <li>Connect TWO switches to its two inputs</li>
                <li>Connect a lamp to its output</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1rem', marginBottom: '0.5rem' }}>Simulate & Observe</h3>
              <p>Try all four combinations:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '300px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Input A</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Input B</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Output</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr style={{ background: '#0f3460' }}>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                  </tr>
                </tbody>
              </table>

              <hr style={{ border: 'none', borderTop: '1px solid #2d3748', margin: '1.5rem 0' }} />

              <h4 style={{ color: '#4fd1c5' }}>OR Gate</h4>
              <p><strong>Rule:</strong> Outputs 1 when EITHER (or both) inputs are 1</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Place an <strong>OR</strong> gate</li>
                <li>Connect TWO switches to its inputs</li>
                <li>Connect a lamp to its output</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1rem', marginBottom: '0.5rem' }}>Simulate & Observe</h3>
              <p>Notice: The lamp is ON when A=1, B=1, or both are 1. It's only OFF when both are 0.</p>

              <hr style={{ border: 'none', borderTop: '1px solid #2d3748', margin: '1.5rem 0' }} />

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <p><strong>Real-World Analogies:</strong></p>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  <li><strong>NOT:</strong> Opposite switch (night light turns on when room light is off)</li>
                  <li><strong>AND:</strong> Car starts only when key is turned AND brake is pressed</li>
                  <li><strong>OR:</strong> Door opens if you use key OR enter the code</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: Could you combine these gates to create new behaviors? What if you wanted a lamp that's ON when inputs are DIFFERENT?
              </p>
            </div>
          )
        },
        {
          id: 'A4',
          title: 'Truth Tables & Logic Circuits',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A <strong>truth table</strong> is a systematic way to show all possible input combinations and their corresponding outputs. It's like a complete instruction manual for a logic gate.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build Understanding</h3>
              <p>Every truth table has:</p>
              <ul>
                <li><strong>Input columns:</strong> All possible combinations of inputs (for 2 inputs: 4 rows)</li>
                <li><strong>Output column:</strong> The result for each input combination</li>
              </ul>

              <p style={{ marginTop: '1rem' }}>Example - OR gate truth table:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '300px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>A</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>B</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>A OR B</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                </tbody>
              </table>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Build the OR gate circuit from A3 again, and this time:</p>
              <ol>
                <li>Write down the truth table on paper</li>
                <li>Test each input combination (row) systematically</li>
                <li>Verify your circuit matches the expected output</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Why Truth Tables Matter:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  Truth tables let us precisely describe any logic function. Engineers use them to design circuits,
                  verify correctness, and communicate how components should behave.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Self-Check</h3>
              <div style={{ background: '#2d3748', padding: '1rem', borderRadius: '4px' }}>
                <p><strong>Quick Quiz:</strong> Can you fill in the missing output for NOT gate?</p>
                <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '200px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Input</th>
                      <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>NOT Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                      <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>?</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                      <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>?</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.5rem', marginBottom: '0' }}>
                  (Answer: 0→1, 1→0)
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: How many rows would a truth table have for a gate with 3 inputs? (Answer: 8 rows, because 2³ = 8)
              </p>
            </div>
          )
        },
        {
          id: 'A5',
          title: 'Combining Gates',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>Gates can be connected together to create new behaviors. Let's build a NAND gate (NOT-AND) by combining an AND with a NOT.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Place an <strong>AND</strong> gate</li>
                <li>Place a <strong>NOT</strong> gate</li>
                <li>Connect two switches to the AND gate inputs</li>
                <li>Connect the AND output to the NOT input</li>
                <li>Connect the NOT output to a lamp</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                You've just created: Switches → AND → NOT → Lamp
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test all four input combinations and observe:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '350px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>A</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>B</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>AND</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>NAND</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                </tbody>
              </table>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <p><strong>NAND = "Not AND" = Opposite of AND</strong></p>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>AND outputs 1 only when both inputs are 1</li>
                  <li>NAND outputs 0 only when both inputs are 1</li>
                  <li>NAND is the opposite!</li>
                </ul>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  <strong>Fun Fact:</strong> NAND is called a "universal gate" - you can build ANY logic circuit using only NAND gates!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Optional Challenge</h3>
              <div style={{ background: '#2d3748', padding: '1rem', borderRadius: '4px' }}>
                <p>Try building a <strong>NOR</strong> gate (NOT-OR) the same way:</p>
                <ol style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  <li>Connect an OR gate to a NOT gate</li>
                  <li>Test and observe: NOR outputs 1 only when BOTH inputs are 0</li>
                </ol>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You just built a new gate from simpler parts. In the same way, complex circuits (like calculators)
                are built from many simple gates connected together. How might you combine gates to solve other problems?
              </p>
            </div>
          )
        },
        {
          id: 'A6',
          title: 'Reflection & Real-World',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Looking Back</h3>
              <p>Congratulations! You've completed Track A. Let's reflect on what you've learned.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>What You've Mastered</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <ul style={{ margin: '0' }}>
                  <li><strong>Binary Logic:</strong> Everything is 1 or 0 (ON or OFF)</li>
                  <li><strong>Basic Gates:</strong> NOT, AND, OR - the building blocks</li>
                  <li><strong>Truth Tables:</strong> How to systematically describe logic</li>
                  <li><strong>Combining Gates:</strong> Creating NAND from AND + NOT</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Where These Gates Live</h3>
              <p>The gates you've been building exist in <strong>every digital device:</strong></p>
              <ul>
                <li>Your smartphone has billions of these gates</li>
                <li>Each gate switches millions of times per second</li>
                <li>Together, they process photos, play games, send messages</li>
              </ul>

              <div style={{ background: '#0f3460', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>
                  💡 From these simple 1s and 0s, we build everything: from calculators to artificial intelligence!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>The Journey Ahead</h3>
              <p>Now that you know the basics, you're ready to build <strong>useful circuits</strong>:</p>

              <div style={{ background: '#2d3748', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                <p style={{ fontWeight: 'bold', marginTop: '0' }}>Track B: Intermediate Logic</p>
                <p style={{ fontSize: '0.875rem', marginBottom: '0' }}>
                  Learn to build circuits that add numbers, select data, and solve real problems.
                  You'll create the same building blocks found in computer processors!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Final Reflection</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You started by turning on a simple lamp. Now you understand how logic gates work together
                to make decisions. What do you want to build next?
              </p>

              <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '6px', marginTop: '2rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.25rem', margin: '0', color: '#00d9ff' }}>
                  🎉 Track A Complete! 🎉
                </p>
                <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem', marginBottom: '0' }}>
                  You've taken your first steps into understanding how computers really work.
                </p>
              </div>
            </div>
          )
        }
      ]
    },
    B: {
      title: 'Track B: Intermediate Logic',
      description: 'Build useful circuits like adders and multiplexers',
      lessons: [
        {
          id: 'B1',
          title: 'XOR Gate - One or the Other',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>XOR (Exclusive OR) outputs 1 when inputs are <strong>different</strong> – one is 1, the other is 0.</p>
              <p>It's like saying "this OR that, but not both."</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>Challenge: Build XOR using the gates you already know (AND, OR, NOT).</p>
              <ol>
                <li>Think about when you want output = 1: when A=1, B=0 OR when A=0, B=1</li>
                <li>One approach: <code>(A OR B) AND (NOT (A AND B))</code></li>
                <li>Place gates and wire them step by step</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
                Hint: You'll need 1 OR gate, 1 AND gate for the inputs, 1 NOT gate, and 1 final AND gate to combine
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test all four input combinations:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '300px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>A</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>B</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>XOR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr style={{ background: '#0f3460' }}>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                  </tr>
                  <tr style={{ background: '#0f3460' }}>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                </tbody>
              </table>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Why XOR Matters:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  XOR is crucial for binary addition – it gives you the sum bit! When you add 1+1 in binary,
                  you get 10 (sum=0, carry=1). That sum bit is exactly what XOR produces.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You just built a new gate from simpler parts. This is exactly how complex circuits are designed –
                layer by layer, building blocks on top of blocks.
              </p>
            </div>
          )
        },
        {
          id: 'B2',
          title: 'Half Adder - Adding 1-bit Numbers',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>How do we add two binary numbers? Let's start with the simplest case: adding two 1-bit numbers.</p>
              <p>When you add 1+1, you get 2, which in binary is "10" – that's a sum of 0 and a carry of 1.</p>
              <p>A <strong>Half Adder</strong> produces two outputs:</p>
              <ul>
                <li><strong>Sum:</strong> The result bit (uses XOR)</li>
                <li><strong>Carry:</strong> The overflow bit (uses AND)</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Place an <strong>XOR</strong> gate (use the one you built, or a provided XOR component)</li>
                <li>Place an <strong>AND</strong> gate</li>
                <li>Connect two input switches (A and B) to <em>both</em> gates</li>
                <li>Connect the XOR output to a lamp labeled "Sum"</li>
                <li>Connect the AND output to a lamp labeled "Carry"</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test all combinations:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '350px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>A</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>B</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Sum</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Carry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center', background: '#0f3460' }}>1</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Notice: 1 + 1 = 10 in binary (Sum=0, Carry=1) ✅
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Why Two Outputs?</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  The XOR gives us the sum for that bit position. The AND tells us if we need to "carry" to the next bit.
                </p>
                <p style={{ marginBottom: '0' }}>
                  This mirrors how you add decimal numbers: 9+3=12 → write down 2, carry the 1.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You just built a component that does arithmetic! Every calculator and computer uses this exact circuit
                (scaled up). You're now doing what engineers do.
              </p>
              <div style={{ background: '#0f3460', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                <strong>💡 Pro Tip:</strong> Consider saving this as a chip – you'll use it to build bigger adders!
              </div>
            </div>
          )
        },
        {
          id: 'B3',
          title: 'Full Adder - Adding Three Bits',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A Half Adder adds two bits. But when adding multi-bit numbers, we need to handle the carry from the previous bit!</p>
              <p>A <strong>Full Adder</strong> adds <em>three</em> bits: A, B, and Carry-In.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>Here's the clever part: you can build a Full Adder from <strong>two Half Adders</strong>!</p>
              <ol>
                <li>Use your Half Adder (or place two XOR + AND combinations)</li>
                <li>First Half Adder: adds A + B → gives Sum1 and Carry1</li>
                <li>Second Half Adder: adds Sum1 + Cin → gives final Sum and Carry2</li>
                <li>OR gate: combines Carry1 and Carry2 → final Carry-Out</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test key cases:</p>
              <ul>
                <li>1 + 1 + 1 = 11 in binary (Sum=1, Carry=1)</li>
                <li>1 + 0 + 1 = 10 in binary (Sum=0, Carry=1)</li>
                <li>0 + 1 + 1 = 10 in binary (Sum=0, Carry=1)</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Hierarchical Design:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  Instead of building from scratch with basic gates, you <em>reused</em> Half Adders.
                  This is exactly how real circuits are designed – building blocks that combine into bigger blocks.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: By reusing Half Adders, you didn't have to think about all the individual gates.
                You worked at a higher level of abstraction. This is the power of modular design!
              </p>
            </div>
          )
        },
        {
          id: 'B4',
          title: 'Multi-Bit Addition (4-bit Ripple Adder)',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>Now let's scale up! To add 4-bit numbers (0-15 in decimal), we chain four Full Adders together.</p>
              <p>Each adder handles one bit position, passing its carry to the next – like a ripple effect.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>The pattern: string Full Adders in series, connecting carry-out to carry-in of the next stage.</p>
              <ol>
                <li>Place 4 Full Adder blocks (or build them from scratch if you're ambitious!)</li>
                <li>Connect: A0+B0 → FA0, A1+B1 → FA1, etc.</li>
                <li>Wire carry: FA0.Cout → FA1.Cin, FA1.Cout → FA2.Cin, FA2.Cout → FA3.Cin</li>
                <li>FA0.Cin = 0 (no carry into the first stage)</li>
                <li>Final carry: FA3.Cout is the overflow bit</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Try adding some 4-bit numbers:</p>
              <ul>
                <li>0101 (5) + 0011 (3) = 1000 (8)</li>
                <li>1111 (15) + 0001 (1) = 10000 (16, with carry-out = 1)</li>
              </ul>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
                Watch the carry "ripple" from right to left as you toggle inputs!
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>From Logic Gates to Math:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  You just built a mini calculator! This ripple-carry adder is how computers actually add numbers.
                  Scale this to 32 or 64 bits, and you have the adder inside a real CPU.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You've built something that "does math" from simple on/off switches. Feel the power of abstraction –
                gates → adders → arithmetic. What else could you build following this pattern?
              </p>
            </div>
          )
        },
        {
          id: 'B5',
          title: 'Multiplexer - Selective Routing',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A <strong>Multiplexer</strong> (or "mux") selects one of multiple inputs to pass through to the output, based on a selector signal.</p>
              <p>Think of it like a railroad switch: the selector decides which track the signal follows.</p>
              <p>A 2-to-1 mux has: 2 data inputs (I0, I1), 1 selector (S), and 1 output (O).</p>
              <ul>
                <li>If S=0, output = I0</li>
                <li>If S=1, output = I1</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>Build using AND, OR, and NOT gates:</p>
              <ol>
                <li>Place two AND gates and one OR gate</li>
                <li>Place one NOT gate</li>
                <li>Wire: I0 AND (NOT S) → first AND output</li>
                <li>Wire: I1 AND S → second AND output</li>
                <li>OR both AND outputs together → final output</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                Logic: When S=0, NOT S=1, so first AND passes I0 (second AND is blocked). When S=1, second AND passes I1.
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test by toggling the selector:</p>
              <ul>
                <li>Set I0=1, I1=0, toggle S between 0 and 1 → output follows S</li>
                <li>Set I0=0, I1=1, toggle S → output is opposite of S</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Why Multiplexers Matter:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  Muxes are used everywhere in CPUs to choose between different data sources.
                  For example, selecting which operation result to use, or which memory location to read.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: This circuit makes <em>decisions</em> based on a control signal. That's fundamentally what control logic does –
                it routes data based on instructions. You're building the brains of a computer!
              </p>
            </div>
          )
        },
        {
          id: 'B6',
          title: 'Combining It All - Simple ALU',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>An <strong>ALU</strong> (Arithmetic Logic Unit) performs multiple operations and uses a selector to choose which result to output.</p>
              <p>Let's build a tiny ALU that can do two operations: AND and OR.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <ol>
                <li>Take two inputs: A and B</li>
                <li>Compute A AND B → feed to mux input I0</li>
                <li>Compute A OR B → feed to mux input I1</li>
                <li>Use a selector switch to choose operation (0=AND, 1=OR)</li>
                <li>Mux output is your result</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test both operations:</p>
              <ul>
                <li>A=1, B=1, Selector=0 → Output=1 (AND)</li>
                <li>A=1, B=0, Selector=1 → Output=1 (OR)</li>
                <li>Toggle selector to switch between operations</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>You Just Built an ALU Component!</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  Real ALUs have dozens of operations (add, subtract, shift, compare, etc.),
                  but the principle is the same: compute multiple results, use muxes to select based on the opcode.
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Optional Challenge</h3>
              <div style={{ background: '#2d3748', padding: '1rem', borderRadius: '4px' }}>
                <p>Expand your ALU to 4 operations using a 4-to-1 mux (needs 2 selector bits):</p>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0', fontSize: '0.875rem' }}>
                  <li>00 = AND</li>
                  <li>01 = OR</li>
                  <li>10 = XOR</li>
                  <li>11 = ADD (use your Half Adder for 1-bit add)</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You're now combining arithmetic (adders) and logic (gates) with control (muxes).
                This is the heart of computation – processing data based on instructions!
              </p>
            </div>
          )
        },
        {
          id: 'B7',
          title: 'Reflection & Real-World Application',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Looking Back</h3>
              <p>Congratulations! You've completed Track B and built some seriously useful circuits.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>What You've Mastered</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <ul style={{ margin: '0' }}>
                  <li><strong>XOR:</strong> Building new gates from existing ones</li>
                  <li><strong>Half & Full Adders:</strong> Binary arithmetic circuits</li>
                  <li><strong>4-bit Ripple Adder:</strong> Scaling up through repetition</li>
                  <li><strong>Multiplexer:</strong> Conditional data routing</li>
                  <li><strong>Simple ALU:</strong> Multiple operations with selection</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Real-World Impact</h3>
              <p>The circuits you built exist in <strong>every digital device:</strong></p>
              <div style={{ background: '#0f3460', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                <ul style={{ margin: '0', fontSize: '0.875rem' }}>
                  <li>Your smartphone's processor has a 64-bit ALU doing billions of operations per second</li>
                  <li>Calculators use ripple-carry adders (or faster variants) for arithmetic</li>
                  <li>Multiplexers route data between CPU cores, memory, and peripherals</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>The Journey Ahead</h3>
              <p>So far, everything you've built is <strong>combinational</strong> – outputs depend only on current inputs.</p>
              <p>But computers need <strong>memory</strong> – circuits that remember state over time.</p>

              <div style={{ background: '#2d3748', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                <p style={{ fontWeight: 'bold', marginTop: '0' }}>Track C: Sequential Logic</p>
                <p style={{ fontSize: '0.875rem', marginBottom: '0' }}>
                  Learn to build circuits with memory – latches, flip-flops, counters, and ultimately a simple CPU
                  that can store and execute instructions. You'll create a computer that remembers!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Final Reflection</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You started with basic gates. Now you can build adders and data selectors.
                Each layer builds on the last. What do you think comes next when we add memory to these circuits?
              </p>

              <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '6px', marginTop: '2rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.25rem', margin: '0', color: '#00d9ff' }}>
                  🎯 Track B Complete! 🎯
                </p>
                <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem', marginBottom: '0' }}>
                  You've mastered combinational logic and built functional arithmetic circuits!
                </p>
              </div>
            </div>
          )
        }
      ]
    },
    C: {
      title: 'Track C: Sequential Logic',
      description: 'Memory, state machines, and simple CPUs',
      lessons: [
        {
          id: 'C1',
          title: 'The Need for Memory',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>So far, everything we've built was <strong>combinational</strong> – outputs depend only on current inputs.</p>
              <p>Turn off the inputs, and the circuit forgets everything. But computers need to <em>remember</em>:</p>
              <ul>
                <li>Did the user click that button?</li>
                <li>What number are we counting to?</li>
                <li>What instruction should run next?</li>
              </ul>
              <p>We need circuits that can <strong>store state over time</strong> – this is called <strong>sequential logic</strong>.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build Understanding</h3>
              <p>Think about a light switch in your house:</p>
              <ul>
                <li>Flip it up → light turns on and STAYS on (even after you let go)</li>
                <li>Flip it down → light turns off and STAYS off</li>
              </ul>
              <p>The switch <em>remembers</em> its position. We need the electronic equivalent!</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate (Thought Experiment)</h3>
              <p>Imagine a combinational circuit controlling a lamp:</p>
              <ul>
                <li>Button pressed (1) → Lamp ON</li>
                <li>Button released (0) → Lamp OFF immediately</li>
              </ul>
              <p>No memory! The lamp forgets the button press instantly.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>The Fundamental Difference:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <strong>Combinational:</strong> Output = function(current inputs)
                </p>
                <p style={{ marginBottom: '0' }}>
                  <strong>Sequential:</strong> Output = function(current inputs, previous state)
                </p>
              </div>
              <p style={{ marginTop: '1rem' }}>
                Sequential circuits have <strong>feedback</strong> – outputs loop back as inputs, creating memory.
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: Without memory, could a computer run programs? Store files? Remember what you typed?
                Memory transforms simple logic gates into powerful computing machines.
              </p>
            </div>
          )
        },
        {
          id: 'C2',
          title: 'SR Latch - Basic Memory Cell',
          content: ({ onDispatchIntent }) => (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>The <strong>SR Latch</strong> (Set-Reset Latch) is the simplest memory circuit. It has two stable states and can be "set" or "reset."</p>
              <p>It uses <strong>feedback</strong> – outputs feed back into inputs – to maintain state.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>Build using two NOR gates with cross-coupled feedback:</p>
              <ol>
                <li>Place two <strong>NOR</strong> gates</li>
                <li>Connect the output of NOR1 to one input of NOR2</li>
                <li>Connect the output of NOR2 to one input of NOR1 (this creates feedback!)</li>
                <li>The remaining input of NOR1 is <strong>S</strong> (Set)</li>
                <li>The remaining input of NOR2 is <strong>R</strong> (Reset)</li>
                <li>NOR1's output is <strong>Q</strong> (the stored bit)</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                The magic: When both S and R are 0, the circuit holds its previous state!
              </p>

              <div style={{ marginTop: '1.5rem' }}>
                <OpenExampleButton
                  exampleId="10_sr-latch"
                  label="🔧 Load SR Latch Example"
                  onDispatchIntent={onDispatchIntent}
                />
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p><strong>Switch to Step mode</strong> to observe state changes clearly:</p>
              <ol>
                <li><strong>Set:</strong> S=1, R=0 → Pulse briefly → Q becomes 1 and stays there</li>
                <li><strong>Hold:</strong> S=0, R=0 → Step forward → Q remains 1 (memory!)</li>
                <li><strong>Reset:</strong> S=0, R=1 → Pulse briefly → Q becomes 0 and stays there</li>
                <li><strong>Hold:</strong> S=0, R=0 → Step forward → Q remains 0 (still remembering!)</li>
              </ol>
              <div style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '4px', marginTop: '0.75rem', fontSize: '0.875rem' }}>
                <strong>⚠️ Troubleshooting:</strong> If you see oscillation or ambiguous behavior, add a <strong>Delay</strong> component on the feedback paths (where outputs loop back to inputs). This gives the circuit time to stabilize.
              </div>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                Note: S=1, R=1 simultaneously is an invalid state (avoid it).
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>How Feedback Creates Memory:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  When S=0 and R=0, each NOR gate's output depends on the <em>other</em> gate's output.
                  If Q=1, it feeds back to keep itself at 1. If Q=0, the feedback keeps it at 0.
                  The circuit is <em>stable</em> in either state – that's memory!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You just built a 1-bit memory! Billions of these (or their descendants) are in your computer's RAM.
                Every bit you store – every document, photo, program – uses memory cells like this.
              </p>
            </div>
          )
        },
        {
          id: 'C3',
          title: 'D Latch - Controlled Memory',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>The SR Latch has an awkward interface (set and reset). What if we just want to store a data bit when told to?</p>
              <p>The <strong>D Latch</strong> (Data Latch) simplifies this: one data input (D) and one enable signal (E).</p>
              <ul>
                <li>When E=1: Output Q follows input D (transparent mode)</li>
                <li>When E=0: Output Q holds its last value (memory mode)</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>Build from an SR Latch plus control gates:</p>
              <ol>
                <li>Start with your SR Latch (or place two NOR gates cross-coupled)</li>
                <li>Add two AND gates and one NOT gate</li>
                <li>Wire: D AND E → S (Set input)</li>
                <li>Wire: (NOT D) AND E → R (Reset input)</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                This ensures S and R are never both 1, and when E=0, both S and R are 0 (hold mode).
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p>Test the enable control in <strong>Step mode</strong>:</p>
              <ol>
                <li>Toggle Enable high (E=1), change D to 1 → Observe Q follows D</li>
                <li>Toggle Enable low (E=0), change D to 0 → Q stays 1 (ignores D, holds state!)</li>
                <li>Toggle Enable high (E=1) again → Q now becomes 0</li>
                <li>Toggle Enable low (E=0), change D to 1 → Q stays 0 (still holding)</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                <strong>Key insight:</strong> When Enable is low, the latch <em>remembers</em> regardless of D changing.
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Why the D Latch Matters:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  The D Latch gives us <em>controlled storage</em>. The enable signal acts like a gate:
                  open it to update the value, close it to preserve the value. This is how RAM works!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You can now "capture" a value at a specific moment and hold it. String 8 of these together,
                and you can store a byte. String billions together, and you have RAM!
              </p>
            </div>
          )
        },
        {
          id: 'C4',
          title: 'D Flip-Flop - Edge-Triggered Memory',
          content: ({ onDispatchIntent }) => (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>The D Latch has a problem: while E=1, output Q continuously follows D. Any noise or glitches get captured!</p>
              <p>A <strong>D Flip-Flop</strong> only captures data at the <em>rising edge</em> of the clock (when Clock goes 0→1).</p>
              <p>This gives us precise, synchronized control – the foundation of all digital systems.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build</h3>
              <p>Build using two D Latches in a master-slave configuration:</p>
              <ol>
                <li>Place two D Latches (or build them from SR Latches)</li>
                <li><strong>Master Latch:</strong> Enable = NOT Clock</li>
                <li><strong>Slave Latch:</strong> Enable = Clock</li>
                <li>Connect: Master's Q output → Slave's D input</li>
                <li>Input D goes to Master's D</li>
                <li>Slave's Q is the final output</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                When Clock=0, Master captures D. When Clock rises to 1, Master freezes and Slave captures Master's output.
              </p>

              <div style={{ marginTop: '1.5rem' }}>
                <OpenExampleButton
                  exampleId="11_d-flipflop"
                  label="🔧 Load D Flip-Flop Example"
                  onDispatchIntent={onDispatchIntent}
                />
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p><strong>Use Step mode and pulse the clock</strong> to see edge-triggering in action:</p>
              <ol>
                <li>Clock=0, set D=1 → Step forward → Nothing happens yet (Master is capturing, Slave is frozen)</li>
                <li>Pulse clock 0→1 (rising edge) → <strong>Q changes only on this edge</strong> → Q becomes 1</li>
                <li>Clock=1, change D=0 → Step forward → Q stays 1 (both latches frozen during high clock)</li>
                <li>Pulse clock 1→0 (falling edge) → Q still 1 (only rising edges matter for DFF)</li>
                <li>Pulse clock 0→1 (rising edge) → Now Q becomes 0</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                <strong>Key insight:</strong> Q changes <em>only</em> on clock rising edges, giving precise, synchronized control.
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Edge-Triggered = Synchronized Computing:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  Flip-flops capture data at precise moments (clock edges), allowing billions of components
                  to work in lockstep. Your CPU clock (e.g., 3 GHz) triggers 3 billion flip-flop updates per second!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: Flip-flops are the heartbeat of digital systems. Every register, every memory cell, every
                state machine uses them. You've just built the component that makes synchronized computation possible!
              </p>
            </div>
          )
        },
        {
          id: 'C5',
          title: 'Registers & Counters',
          content: ({ onDispatchIntent }) => (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A <strong>register</strong> is a group of flip-flops that store multiple bits (like a 4-bit or 8-bit number).</p>
              <p>A <strong>counter</strong> is a register that increments its value on each clock tick.</p>

              <div style={{ marginTop: '1.5rem' }}>
                <OpenExampleButton
                  exampleId="04_4bit-counter"
                  label="🔧 Load 4-bit Counter Example"
                  onDispatchIntent={onDispatchIntent}
                />
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build a 2-bit Counter</h3>
              <p>We'll build a simple counter that counts 0 → 1 → 2 → 3 → 0 (repeating).</p>
              <ol>
                <li>Place two D Flip-Flops (Q0 for bit 0, Q1 for bit 1)</li>
                <li>Connect Clock to both flip-flops</li>
                <li>For Q0: Connect D0 = NOT Q0 (toggles every clock)</li>
                <li>For Q1: Connect D1 = Q1 XOR Q0 (toggles when Q0 goes from 1 to 0)</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                Alternative: Use your adder from Track B to add 1 to the current value!
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p><strong>Pulse the clock repeatedly</strong> and watch the binary count evolve:</p>
              <ol style={{ marginBottom: '1rem' }}>
                <li>Start in Step mode or slow simulation</li>
                <li>Pulse clock → Observe Q1 Q0 increment from 00 to 01</li>
                <li>Pulse clock again → 01 to 10</li>
                <li>Continue pulsing and watch the pattern: 00 → 01 → 10 → 11 → 00 (repeats)</li>
                <li>Pause between pulses to inspect the current state</li>
              </ol>
              <p>Expected sequence:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '300px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Clock Tick</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Q1 Q0</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0 0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0 1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>2</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1 0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>2</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>3</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>1 1</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>3</td>
                  </tr>
                  <tr style={{ background: '#0f3460' }}>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>4</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0 0</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem', textAlign: 'center' }}>0</td>
                  </tr>
                </tbody>
              </table>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>Registers & Counters in CPUs:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  <li><strong>Program Counter (PC):</strong> Tracks which instruction to execute next</li>
                  <li><strong>Instruction Register (IR):</strong> Holds the current instruction</li>
                  <li><strong>General Registers:</strong> Store temporary values during computation</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: A counter is a circuit that evolves over time, changing state with each clock.
                This is the essence of sequential logic – circuits that <em>do things</em> step by step!
              </p>
            </div>
          )
        },
        {
          id: 'C6',
          title: 'Finite State Machines',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A <strong>Finite State Machine</strong> (FSM) is a circuit that moves through a sequence of states based on inputs.</p>
              <p>Example: A traffic light controller with states: GREEN → YELLOW → RED → GREEN...</p>
              <p>FSMs combine:</p>
              <ul>
                <li><strong>State Register:</strong> Flip-flops storing current state</li>
                <li><strong>Next-State Logic:</strong> Combinational logic determining next state</li>
                <li><strong>Output Logic:</strong> What to output in each state</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build a Simple FSM</h3>
              <p>Let's build a 2-state toggle machine: Press button → toggle between OFF and ON.</p>
              <ol>
                <li>Place 1 D Flip-Flop to store state (0=OFF, 1=ON)</li>
                <li>Add XOR gate: D = Q XOR Button</li>
                <li>Connect Clock (or use button as clock with debouncing)</li>
                <li>Output: Q drives a lamp</li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                Each button press (clock edge) toggles the state!
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p><strong>Step through transitions</strong> and keep a note of the current state:</p>
              <ul>
                <li>Initial: Q=0 (OFF), Lamp dark — <em>Pause and inspect state encoding</em></li>
                <li>Button press 1: Q=1 (ON), Lamp lights — <em>Observe state transition</em></li>
                <li>Button press 2: Q=0 (OFF), Lamp dark — <em>State has changed again</em></li>
                <li>Button press 3: Q=1 (ON), Lamp lights — <em>Pattern repeats</em></li>
              </ul>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.75rem' }}>
                <strong>Tip:</strong> Use Step mode to advance one transition at a time and verify the state logic is correct before running continuously.
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>FSMs Are Everywhere:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  <li>Vending machines (accepting coins, dispensing items)</li>
                  <li>Elevator controllers (moving between floors)</li>
                  <li>Network protocols (handshake, data transfer, close)</li>
                  <li>Game logic (menu, playing, paused, game over)</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Optional Challenge</h3>
              <div style={{ background: '#2d3748', padding: '1rem', borderRadius: '4px' }}>
                <p>Build a 3-state traffic light FSM:</p>
                <ol style={{ marginTop: '0.5rem', marginBottom: '0', fontSize: '0.875rem' }}>
                  <li>Use 2 flip-flops to store 3 states (00=Green, 01=Yellow, 10=Red)</li>
                  <li>Design next-state logic: Green→Yellow, Yellow→Red, Red→Green</li>
                  <li>Output: Light 3 lamps based on current state</li>
                </ol>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: FSMs let circuits <em>behave</em> – they follow rules, make decisions, and change over time.
                This is the bridge from static logic to dynamic, intelligent systems!
              </p>
            </div>
          )
        },
        {
          id: 'C7',
          title: 'Simple CPU - Bringing It All Together',
          content: ({ onDispatchIntent }) => (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Concept</h3>
              <p>A <strong>CPU</strong> (Central Processing Unit) is a state machine that fetches instructions from memory and executes them.</p>
              <p>Let's design a minimal CPU with:</p>
              <ul>
                <li><strong>Program Counter (PC):</strong> Points to next instruction</li>
                <li><strong>Instruction Register (IR):</strong> Holds current instruction</li>
                <li><strong>ALU:</strong> Performs operations</li>
                <li><strong>Accumulator (ACC):</strong> Stores result</li>
              </ul>

              <div style={{ marginTop: '1.5rem' }}>
                <OpenExampleButton
                  exampleId="05_simple-cpu"
                  label="🔧 Load Simple CPU Example"
                  onDispatchIntent={onDispatchIntent}
                />
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Build Conceptual Components</h3>
              <p>This is a design exercise – building a full CPU is complex, but understanding the parts is achievable:</p>
              <ol>
                <li><strong>PC:</strong> A counter (from C5) that increments each cycle</li>
                <li><strong>IR:</strong> A register (from C5) storing the instruction</li>
                <li><strong>ALU:</strong> Use your adder + logic gates from Track B</li>
                <li><strong>ACC:</strong> Another register storing the result</li>
                <li><strong>Control Unit:</strong> An FSM decoding the instruction and sequencing operations</li>
              </ol>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Simulate</h3>
              <p><strong>Use Step mode to walk through fetch → decode → execute</strong> one instruction at a time:</p>
              <p>Imagine a simple instruction set:</p>
              <table style={{ borderCollapse: 'collapse', margin: '0.5rem 0', width: '100%', maxWidth: '400px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Instruction</th>
                    <th style={{ border: '1px solid #444', padding: '0.5rem', background: '#1a1a2e' }}>Operation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem' }}>LOAD 5</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem' }}>ACC = 5</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem' }}>ADD 3</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem' }}>ACC = ACC + 3</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #444', padding: '0.5rem' }}>STORE 10</td>
                    <td style={{ border: '1px solid #444', padding: '0.5rem' }}>Memory[10] = ACC</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ marginTop: '1rem' }}>Execution cycle (step through each phase):</p>
              <ol>
                <li><strong>Fetch:</strong> Read instruction from Memory[PC] — <em>Watch PC/IR values change</em></li>
                <li><strong>Decode:</strong> Control unit interprets the opcode — <em>Pause and inspect IR</em></li>
                <li><strong>Execute:</strong> ALU performs operation, update ACC — <em>Watch ACC change per instruction</em></li>
                <li><strong>Increment PC:</strong> Move to next instruction — <em>Verify PC advances</em></li>
              </ol>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0.75rem' }}>
                <strong>Tip:</strong> Step through each phase of the cycle manually to see how PC, IR, and ACC evolve. This is how debuggers work!
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <strong>The Fetch-Decode-Execute Cycle:</strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                  Every CPU – from tiny microcontrollers to supercomputers – follows this cycle billions of times per second.
                  Your computer is running this loop right now to display these words!
                </p>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Explain</h3>
              <div style={{ background: '#0f3460', padding: '1rem', borderRadius: '4px' }}>
                <strong>What You've Built Across All Tracks:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: '0', fontSize: '0.875rem' }}>
                  <li><strong>Track A:</strong> Logic gates (the atoms)</li>
                  <li><strong>Track B:</strong> ALU components (the arithmetic engine)</li>
                  <li><strong>Track C:</strong> Memory & control (the brain)</li>
                  <li><strong>Together:</strong> A computer!</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Reflect</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: From simple 1s and 0s, through gates, adders, memory, and state machines,
                you've traced the path to a functioning CPU. Every computer is built this way – layer by layer,
                abstraction by abstraction. You now understand the foundation of all computing!
              </p>
            </div>
          )
        },
        {
          id: 'C8',
          title: 'Reflection & The Journey Forward',
          content: (
            <div>
              <h3 style={{ color: '#00d9ff', marginBottom: '0.5rem' }}>Looking Back on the Entire Journey</h3>
              <p>Congratulations! You've completed all three tracks and built a complete understanding of digital logic.</p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>What You've Mastered</h3>
              <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px' }}>
                <p style={{ fontWeight: 'bold', marginTop: '0', marginBottom: '0.5rem' }}>Track A: Foundations</p>
                <ul style={{ fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
                  <li>Binary logic and truth tables</li>
                  <li>Basic gates: NOT, AND, OR, NAND, NOR</li>
                  <li>Combining gates to create new functions</li>
                </ul>

                <p style={{ fontWeight: 'bold', marginTop: '0', marginBottom: '0.5rem' }}>Track B: Combinational Logic</p>
                <ul style={{ fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
                  <li>XOR gates and arithmetic circuits</li>
                  <li>Half Adders, Full Adders, Ripple-Carry Adders</li>
                  <li>Multiplexers and simple ALUs</li>
                </ul>

                <p style={{ fontWeight: 'bold', marginTop: '0', marginBottom: '0.5rem' }}>Track C: Sequential Logic</p>
                <ul style={{ fontSize: '0.875rem', margin: '0' }}>
                  <li>Latches and flip-flops for memory</li>
                  <li>Registers and counters</li>
                  <li>Finite State Machines</li>
                  <li>CPU architecture and the fetch-decode-execute cycle</li>
                </ul>
              </div>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>From Gates to Intelligence</h3>
              <p>You started with a simple lamp and switch. Now you understand:</p>
              <div style={{ background: '#0f3460', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                <ul style={{ margin: '0', fontSize: '0.875rem' }}>
                  <li>How computers perform arithmetic (ALU)</li>
                  <li>How computers remember information (latches, flip-flops, registers)</li>
                  <li>How computers make decisions (FSMs, control units)</li>
                  <li>How computers execute programs (CPU fetch-decode-execute)</li>
                </ul>
              </div>
              <p style={{ marginTop: '1rem' }}>
                <strong>Every program you've ever run</strong> – games, apps, operating systems – is ultimately
                billions of these simple circuits switching on and off, billions of times per second.
              </p>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Where to Go Next</h3>
              <p>Your journey in digital logic doesn't have to end here. Consider exploring:</p>
              <ul>
                <li><strong>More Complex CPUs:</strong> Pipelining, caching, branch prediction</li>
                <li><strong>Memory Systems:</strong> RAM, ROM, flash storage architectures</li>
                <li><strong>Hardware Description Languages:</strong> Verilog, VHDL for designing real chips</li>
                <li><strong>FPGA Development:</strong> Program your own hardware on reconfigurable chips</li>
                <li><strong>Computer Architecture:</strong> Study how modern processors achieve incredible speed</li>
              </ul>

              <h3 style={{ color: '#00d9ff', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Final Reflection</h3>
              <p style={{ fontStyle: 'italic', color: '#a0aec0' }}>
                Think: You now see the world differently. Every device around you – phone, laptop, car, thermostat –
                is running circuits like the ones you built. You understand the fundamental language of computation.
                What will you build with this knowledge?
              </p>

              <div style={{ background: '#1a1a2e', padding: '2rem', borderRadius: '8px', marginTop: '2.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: '#00d9ff' }}>
                  🎓 All Tracks Complete! 🎓
                </p>
                <p style={{ fontSize: '1rem', color: '#e0e0e0', marginTop: '0.5rem', marginBottom: '1rem' }}>
                  You've journeyed from basic gates to CPU architecture
                </p>
                <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginTop: '0', marginBottom: '0' }}>
                  You now understand how computers work at the deepest level.
                  This knowledge is the foundation of all computing – use it wisely and build amazing things!
                </p>
              </div>
            </div>
          )
        }
      ]
    }
  };

  const currentTrack = selectedTrack ? tracks[selectedTrack] : null;
  const currentLesson = currentTrack?.lessons[currentLessonIndex];

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#0f1419',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '280px',
        borderRight: '1px solid #2d3748',
        padding: '1.5rem',
        overflowY: 'auto'
      }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#00d9ff' }}>
          Logic Help
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginBottom: '1.5rem' }}>
          Learn digital logic from gates to CPUs
        </p>

        {!selectedTrack ? (
          <div>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Choose a Track:</h2>
            {(Object.keys(tracks) as Track[]).map((trackKey) => (
              <button
                key={trackKey}
                onClick={() => {
                  setSelectedTrack(trackKey);
                  setCurrentLessonIndex(0);
                }}
                style={{
                  width: '100%',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  background: '#1a1a2e',
                  border: '1px solid #2d3748',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2d3748';
                  e.currentTarget.style.borderColor = '#00d9ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a2e';
                  e.currentTarget.style.borderColor = '#2d3748';
                }}
              >
                <div style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                  {tracks[trackKey].title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                  {tracks[trackKey].description}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelectedTrack(null)}
              style={{
                marginBottom: '1rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid #2d3748',
                borderRadius: '4px',
                color: '#00d9ff',
                cursor: 'pointer'
              }}
            >
              ← Back to Tracks
            </button>

            <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
              {currentTrack?.title}
            </h2>

            <div>
              {currentTrack?.lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  onClick={() => setCurrentLessonIndex(index)}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: index === currentLessonIndex ? '#2d3748' : 'transparent',
                    borderLeft: index === currentLessonIndex ? '3px solid #00d9ff' : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ fontSize: '0.875rem' }}>
                    {lesson.id}. {lesson.title}
                  </div>
                  {completedLessons.has(lesson.id) && (
                    <div style={{ fontSize: '0.875rem', color: '#00d9ff' }}>
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '2rem 3rem',
        overflowY: 'auto',
        maxWidth: '800px'
      }}>
        {currentLesson ? (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#a0aec0', marginBottom: '0.5rem' }}>
                {currentTrack?.title} / Lesson {currentLessonIndex + 1} of {currentTrack?.lessons.length}
              </div>
              <h1 style={{ fontSize: '2rem', color: '#00d9ff' }}>
                {currentLesson.title}
              </h1>
            </div>

            <div style={{ lineHeight: '1.7', fontSize: '1rem' }}>
              {typeof currentLesson.content === 'function'
                ? currentLesson.content({ onDispatchIntent })
                : currentLesson.content}
            </div>

            {/* Checklist Placeholder */}
            <div style={{
              marginTop: '2.5rem',
              padding: '1.5rem',
              background: '#1a1a2e',
              borderRadius: '6px',
              border: '1px solid #2d3748'
            }}>
              <h3 style={{ fontSize: '1rem', color: '#00d9ff', marginBottom: '0.75rem' }}>
                ✅ Checklist (Scaffolding)
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0', marginBottom: '1rem' }}>
                Future integration will verify these automatically with the Playground:
              </p>
              <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                <div style={{ marginBottom: '0.5rem' }}>☐ I placed the required components</div>
                <div style={{ marginBottom: '0.5rem' }}>☐ I connected the wires correctly</div>
                <div style={{ marginBottom: '0.5rem' }}>☐ I toggled inputs and observed outputs</div>
                <div>☐ I understand the concept</div>
              </div>
            </div>

            {/* Mark as Done Button */}
            <div style={{
              marginTop: '1.5rem',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  const newCompleted = new Set(completedLessons);
                  const wasCompleted = completedLessons.has(currentLesson.id);

                  if (wasCompleted) {
                    newCompleted.delete(currentLesson.id);
                  } else {
                    newCompleted.add(currentLesson.id);

                    // Trigger narrative events for specific Track C milestones
                    if (currentLesson.id === 'C8') {
                      triggerNarrative('milestone.trackCComplete', {
                        trackId: 'C',
                        lessonId: currentLesson.id,
                      });
                    }
                  }
                  setCompletedLessons(newCompleted);
                }}
                style={{
                  padding: '0.75rem 2rem',
                  background: completedLessons.has(currentLesson.id) ? '#2d3748' : '#00d9ff',
                  border: completedLessons.has(currentLesson.id) ? '1px solid #00d9ff' : 'none',
                  borderRadius: '6px',
                  color: completedLessons.has(currentLesson.id) ? '#00d9ff' : '#0f1419',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
              >
                {completedLessons.has(currentLesson.id) ? '✓ Marked as Done' : 'Mark as Done'}
              </button>
            </div>

            {/* Navigation */}
            <div style={{
              marginTop: '2rem',
              paddingTop: '2rem',
              borderTop: '1px solid #2d3748',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setCurrentLessonIndex(Math.max(0, currentLessonIndex - 1))}
                disabled={currentLessonIndex === 0}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: currentLessonIndex === 0 ? '#1a1a2e' : '#2d3748',
                  border: '1px solid #2d3748',
                  borderRadius: '6px',
                  color: currentLessonIndex === 0 ? '#666' : '#e0e0e0',
                  cursor: currentLessonIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Previous
              </button>

              {currentLessonIndex < (currentTrack?.lessons.length || 0) - 1 && (
                <button
                  onClick={() => setCurrentLessonIndex(currentLessonIndex + 1)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#00d9ff',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#0f1419',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#a0aec0' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              Welcome to Logic Help!
            </h2>
            <p>Choose a track from the sidebar to begin your journey.</p>
          </div>
        )}
      </div>
    </div>
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
