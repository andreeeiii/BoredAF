import BafButton from "./components/BafButton";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950">
      <h1 className="mb-12 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
        Bored<span className="text-red-500">AF</span>
      </h1>
      <BafButton />
    </main>
  );
}
