# Visual Graph Spec

```gherkin
Feature: Visual Graph Systems
  As a developer
  I want to author gameplay systems as visual graphs
  So I can create features with simple building blocks instead of handwritten code

  Background:
    Given the editor is open
    And system graphs are stored as JSON assets
    And the runtime can execute graph-backed systems alongside ECS systems
    And the current gameplay systems still exist in the app as the source of truth for behavior

  Scenario: Convert existing systems to JSON graphs
    Given the current gameplay systems are implemented in TypeScript
    When we create graph assets for each system
    Then the following systems are represented as JSON graphs:
      | player-control |
      | enemy-follow |
      | actor-state |
      | sprite-facing |
      | restart-on-enemy-touch |
    And each graph matches the behavior of its TypeScript version

  Scenario: Keep the graph language simple
    Given a developer is authoring a system graph
    When they open the node palette
    Then they only see small building-block nodes
    And they do not need loops, custom functions, or general-purpose scripting for the first version
    And the graph remains readable to non-programmers

  Scenario: Support the existing gameplay patterns
    Given the current systems in the game
    When I map them to graph nodes
    Then the graph model supports these behaviors:
      | read input and set velocity |
      | find a target entity and follow it |
      | read velocity and switch animation state |
      | read velocity and flip facing |
      | detect enemy collision and reset entities |

  Scenario: Define graph assets in JSON
    Given a system graph exists
    When it is saved to disk
    Then it is stored as JSON under the Systems content folder
    And it contains nodes, edges, entrypoints, and metadata
    And the JSON is the source of truth

  Scenario: Execute a graph at runtime
    Given a system graph has been loaded
    When the game update loop runs
    Then the graph executes as part of the normal ECS loop
    And the graph can read component stores
    And the graph can write component stores
    And the graph can react to collisions and input

  Scenario: Build the first graph executor
    Given the runtime needs to run graph-backed systems
    When the executor is implemented
    Then it can handle these node types:
      | OnUpdate |
      | OnCollision |
      | Sequence |
      | If |
      | FindEntityWithTag |
      | GetComponent |
      | InputHeld |
      | CollisionWithTag |
      | Compare |
      | Add |
      | Subtract |
      | Multiply |
      | Normalize |
      | Clamp |
      | SetComponent |
      | SetState |
      | FlipFacing |
      | ResetEntity |
      | SetVelocity |

  Scenario: Visualize graphs read-only
    Given a graph has been converted to JSON
    When the editor opens it
    Then the editor shows nodes on a canvas
    And the editor shows connections between ports
    And the editor can inspect the graph structure
    And the editor cannot edit the graph yet

  Scenario: Add graph editing later
    Given the read-only visualizer is working
    When we enable editing
    Then the editor can add nodes
    And the editor can move nodes
    And the editor can connect ports
    And the editor can delete nodes and edges
    And the editor can save changes back to JSON

  Scenario: Keep responsibilities separated
    Given the runtime package owns graph execution
    When the app boots
    Then the app composes gameplay and editor features
    And the app does not own the graph execution engine
    And the content folder stores graph assets only

  Scenario: Preserve milestone order
    Given the graph system is being built
    When work progresses
    Then JSON graphs come before the visual editor
    And the visual editor comes before editing interactions
    And the existing TypeScript systems remain the acceptance test until parity is reached
```
