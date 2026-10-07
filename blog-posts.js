// Shape: { slug, title, date: 'YYYY-MM-DD', description,
//          sections: [{ title?, paragraphs: ['...'] }] }
// Wrap text in *asterisks* to italicize it.
export const posts = [{
  slug: 'good-software-engineer-post-ai',
  title: 'What does it mean to be a "good" software engineer?',
  date: '2026-10-07',
  description: 'a short analysis on the change of programming proficiency',
  sections: [{
    paragraphs: [
      'In a prior internship of mine, I was responsible for building a data handling system that would enable several-million-dollar tests to skip the multi-day process that a telemetry engineer would spend on their sensor layout. Naturally, this was great news!',
      'But during development, it almost failed spectacularly.',
      'Some sensor layouts simply aren\'t possible with a given configuration. When that happens, the test engineer has to be told immediately, so they can adjust their config until it works. However, in the development of this program, my AI assistant had declared it had uncovered a different answer!',
      'It would simply implement a greedy fallback!',
      'No. Naturally, this was a terrible idea. Why would you let a failing test-case fail gracefully in a situation where it may literally cost you seven-figures? The system would hand back a layout that looked valid, and nobody would know anything was wrong until it mattered. Like, *really* mattered. It goes without saying, but I immediately rejected that solution, deleted the relevant produced code, and continued to hold ownership over the program while reviewing Every. Single. Decision.',
      'Writing code, fundamentally, has changed. I believe this experience of mine to be one of many proofs of it.',
      'Simply, the job has shifted from not only being proficient in *producing code*, but *judging* it. When an AI tool can output 20 completely plausible solutions to any edge case you may be facing, the impressive skill now is knowing which one is ideal for *your* system, not just *a* system. How *your* team would be impacted, how *your* constraints would be satisfied, and ultimately, how your decisions have led up to this change.',
      'You, essentially, have gone from a code-producer to a code-verifier. Not that cool! But AI-generated code can be so confidently incorrect while still seeming right. Fallbacks always implemented that simply make no sense. Security holes that no good engineer would let pass. So, now, a good engineer produces code with a tool, and treats it as if it was written by a junior.',
      'Everyone has become a senior-engineer.',
      'But it\'s an interesting dilemma, because not everyone is fit to be a senior engineer. Not yet. Some people simply prompt their AI-assistants asking it to ‘continue’, ‘move on’, ‘implement this’, with no idea of *how* it should do it. They are unable to come up with a cursory solution, and, more importantly, would be unable to verify the effectiveness of the produced one.',
      'A good engineer would never pass a major PR to prod without reviewing it.',
      'Essentially, you must use the tool, without letting it degrade your skills. You must be fluent with AI. Delegate to it the simple task you don\'t want to, ask it to explore an unfamiliar API and return the data it analyzes, be fast, generate tasks, and prototype. But the important part is that you absolutely must keep your skills sharp.',
      'Sometimes, I think about that fallback and giggle. A truly ridiculous solution, but it wasn’t a dumb one. It was a great answer to a completely incorrect question: one that was only caught because I knew what *my* system needed.'
    ]
  }]
}];
