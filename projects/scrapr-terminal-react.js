(() => {
  const mount = document.getElementById('scrapr-terminal');
  if (!mount || !window.React || !window.ReactDOM) return;

  const {
    Children,
    createContext,
    createElement: h,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
  } = window.React;

  const SequenceContext = createContext(null);
  const ItemIndexContext = createContext(null);

  function useOnScreen(ref) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      if (!ref.current) return;
      if (!('IntersectionObserver' in window)) {
        setVisible(true);
        return;
      }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      }, { threshold: 0.3 });
      observer.observe(ref.current);
      return () => observer.disconnect();
    }, [ref]);
    return visible;
  }

  function AnimatedSpan({ children, className = '' }) {
    const sequence = useContext(SequenceContext);
    const itemIndex = useContext(ItemIndexContext);
    const [shown, setShown] = useState(false);

    useEffect(() => {
      if (!sequence?.sequenceStarted || sequence.activeIndex !== itemIndex) return;
      setShown(true);
      const timer = window.setTimeout(() => sequence.completeItem(itemIndex), 190);
      return () => window.clearTimeout(timer);
    }, [sequence, itemIndex]);

    return h('div', {
      className: `terminal-line ${className}`,
      'aria-hidden': !shown,
      style: {
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(-4px)',
        transition: 'opacity .18s ease, transform .18s ease',
      },
    }, children);
  }

  function TypingAnimation({ children, duration = 24, className = '' }) {
    const sequence = useContext(SequenceContext);
    const itemIndex = useContext(ItemIndexContext);
    const [text, setText] = useState('');
    const [started, setStarted] = useState(false);

    useEffect(() => {
      if (sequence?.sequenceStarted && sequence.activeIndex === itemIndex && !started) setStarted(true);
    }, [sequence, itemIndex, started]);

    useEffect(() => {
      if (!started) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setText(children);
        sequence.completeItem(itemIndex);
        return;
      }
      let index = 0;
      const interval = window.setInterval(() => {
        index += 1;
        setText(children.slice(0, index));
        if (index >= children.length) {
          window.clearInterval(interval);
          sequence.completeItem(itemIndex);
        }
      }, duration);
      return () => window.clearInterval(interval);
    }, [started, children, duration]);

    return h('div', { className: `terminal-line ${className}${started && text.length < children.length ? ' terminal-cursor' : ''}` }, text);
  }

  function Terminal({ children, sequence = true, startOnView = true }) {
    const containerRef = useRef(null);
    const isInView = useOnScreen(containerRef);
    const [activeIndex, setActiveIndex] = useState(0);
    const sequenceStarted = sequence && (!startOnView || isInView);
    const contextValue = useMemo(() => ({
      activeIndex,
      sequenceStarted,
      completeItem: (index) => setActiveIndex((current) => index === current ? current + 1 : current),
    }), [activeIndex, sequenceStarted]);
    const wrapped = Children.toArray(children).map((child, index) =>
      h(ItemIndexContext.Provider, { value: index, key: index }, child)
    );

    return h(SequenceContext.Provider, { value: contextValue },
      h('div', { ref: containerRef, className: 'mac-terminal' },
        h('div', { className: 'terminal-titlebar' },
          h('div', { className: 'terminal-lights', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
          h('div', { className: 'terminal-title' }, 'scrapr — search trace')
        ),
        h('div', { className: 'terminal-body' }, wrapped)
      )
    );
  }

  const lines = [
    [TypingAnimation, '$ search --topic="machine learning" --institution="MIT"', 'command', 17],
    [AnimatedSpan, 'Searching OpenAlex for machine learning at MIT…', 'muted'],
    [AnimatedSpan, '✓ Expanded query: machine learning, deep neural networks, representation learning…', 'success'],
    [AnimatedSpan, '✓ Found 12 related concepts', 'success'],
    [AnimatedSpan, 'Fetching OpenAlex (Concept Search) page 1…', 'muted'],
    [AnimatedSpan, '✓ Total unique works found: 342', 'success'],
    [AnimatedSpan, '− Filtered 8 researchers without publications since 2022', 'muted'],
    [AnimatedSpan, '− Filtered 3 researchers not primarily at MIT', 'muted'],
    [TypingAnimation, 'Ranking 21 researchers by relevancy to: "machine learning"', 'command', 12],
    [AnimatedSpan, 'Processing batch 1/5… 2/5… 3/5… 4/5… 5/5', 'muted'],
    [AnimatedSpan, '=== Relevancy Scoring Results ===', 'result'],
    [AnimatedSpan, 'Total Researchers Scored: 21  ·  Above Threshold: 21', 'result'],
    [AnimatedSpan, '1. Dr. Regina Barzilay', 'success'],
    [AnimatedSpan, '   Relevancy Score: 87.3%', 'success'],
    [TypingAnimation, '   Paper: "Deep Learning for Drug Discovery"', 'success', 14],
  ];

  function SearchTrace() {
    const [replay, setReplay] = useState(0);
    return h(window.React.Fragment, null,
      h('button', { type: 'button', className: 'terminal-replay', onClick: () => setReplay((value) => value + 1) }, 'Replay trace'),
      h(Terminal, { key: replay, sequence: true, startOnView: true },
        ...lines.map(([Component, text, className, duration], index) =>
          h(Component, { className, duration, key: index }, text)
        )
      )
    );
  }
  window.ReactDOM.createRoot(mount).render(h(SearchTrace));
})();
