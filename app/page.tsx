export default function Home() {
  return (
    <>
      <header>
        <nav>
          <div className="">Ollama Web UI</div>
          <div className="">
            <select>
              <option value="" disabled>
                Select a model
              </option>
              <option value="gpt-2">GPT-2</option>
              <option value="gpt-3">GPT-3</option>
              <option value="t5">T5</option>
            </select>
          </div>
        </nav>
      </header>
    </>
  );
}
