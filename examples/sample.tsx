// Manual test fixture. Open this in the Extension Development Host to verify highlighting.

function greet(name: string, greeting = 'Hello') {
  const message = `${greeting}, ${name}!`;
  console.log(message);
  return { name, greeting, message };
}

function process({ id, items }: { id: string; items: number[] }) {
  return items.map((item) => ({ id, item }));
}

const callback = (event: { type: string }, ...rest: unknown[]) => {
  if (event.type === 'click') {
    handle({ event, rest });
  }
};

function handle(_payload: unknown) {}

function outer(x: number) {
  function inner(x: number) {
    return x + 1;
  }
  return x + inner(x);
}

interface Props {
  name: string;
  age: number;
}

function Card({ name, age }: Props) {
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>Age: {age}</p>
      <Inner name={name} />
    </div>
  );
}

function Inner({ name }: { name: string }) {
  return <span>{name}</span>;
}

class Service {
  constructor(private readonly client: { fetch: () => unknown }) {}

  load(id: string, opts: { signal?: AbortSignal }) {
    return this.client.fetch.call(this.client, { id, signal: opts.signal });
  }
}

greet('world');
process({ id: 'x', items: [1, 2, 3] });
callback({ type: 'click' });
outer(1);
new Service({ fetch: () => null }).load('1', {});
