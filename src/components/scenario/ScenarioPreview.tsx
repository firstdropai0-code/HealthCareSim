import type { Scenario } from "@/types/scenario";

function BriefTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-800">{value}</dd>
    </div>
  );
}

export function ScenarioPreview({ scenario }: { scenario: Scenario }) {
  return (
    <section className="overflow-hidden rounded-lg border border-emerald-900/10 bg-white shadow-sm">
      <div className="bg-emerald-950 px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase text-emerald-200">Scenario brief</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{scenario.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">{scenario.summary}</p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3">
        <BriefTile label="Setting" value={scenario.setting} />
        <BriefTile label="Patient" value={scenario.patientProfile} />
        <BriefTile label="Emotion" value={scenario.patientEmotion} />
      </div>

      <div className="border-y border-slate-200 bg-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase text-emerald-800">Start here</p>
        <p className="mt-2 text-base leading-7 text-emerald-950">{scenario.firstPrompt}</p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Trainee objective</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{scenario.traineeObjective}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase text-amber-700">Communication challenge</p>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            {scenario.communicationChallenge}
          </p>
        </div>
      </div>

      <details className="border-t border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700 hover:text-emerald-800">
          View facilitator details
        </summary>
        <dl className="grid gap-4 px-5 pb-5 md:grid-cols-2">
          <BriefTile label="Family emotion" value={scenario.familyEmotion || "Not specified"} />
          <BriefTile label="Starting situation" value={scenario.startingSituation} />
          <BriefTile label="Ending condition" value={scenario.endingCondition} />
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Evaluation criteria
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {scenario.evaluationCriteria.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {item}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
