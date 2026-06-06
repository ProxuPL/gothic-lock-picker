# Gothic Remake Lock Picker
A browser-based lock-picking solver for Gothic Remake. Instead of guessing which latch to move next, just input your current pin positions and the dependency matrix from the in-game lock — the solver finds the shortest possible solution using BFS (Breadth-First Search) across the full state space.
No moves are wasted, no pick is broken. Results are shown step-by-step with a compressed summary so you can execute them quickly in-game.
Features: optimal BFS solution · dependency matrix editor · compressed move blocks · full step-by-step table · runs entirely in the browser
# Site is live here https://gothic-lock-picker.vercel.app/
