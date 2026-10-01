import { useCallback, useEffect, useState } from "react";
import JobForm from "../components/JobForm.jsx";
import { api, errMsg } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { EMPTY_JOB, toDate } from "../lib/jobForm.js";

const STATUS = {
  pending: ["Waiting for approval", "bg-amber-100 text-amber-800"],
  approved: ["Live", "bg-green-100 text-green-700"],
  rejected: ["Rejected", "bg-red-100 text-red-700"],
};

const statusOf = (j) =>
  j.review?.status === "approved" && !j.active
    ? ["Closed", "bg-slate-100 text-slate-500"]
    : STATUS[j.review?.status] || ["Closed", "bg-slate-100 text-slate-500"];

export default function Employer() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const company = {
    companyName: user.company?.name || "",
    companyWebsite: user.company?.website || "",
  };

  const load = useCallback(() => {
    api
      .get("/employer/jobs")
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api
      .get("/jobs/meta")
      .then((r) => setMeta(r.data))
      .catch(() => {});
  }, []);

  const act = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await fn();
      setError("");
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };
  const edit = (j) =>
    setEditing({
      ...EMPTY_JOB,
      ...j,
      ...company,
      email: j.emails?.[0] || "",
      phone: j.phones?.[0] || "",
      level: j.level || "",
      validThrough: toDate(j.validThrough),
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My job posts</h1>
          <p className="text-sm text-slate-500">
            {company.companyName}
            {data &&
              ` · ${data.postedToday} of ${data.dailyLimit} jobs posted today`}
            {data?.requireApproval &&
              " · New and edited jobs go live after our team approves them."}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setEditing({ ...EMPTY_JOB, ...company })}
          >
            Post a new job
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {editing && (
        <JobForm
          key={editing._id || "new"}
          initial={editing}
          meta={meta}
          endpoint="/employer/jobs"
          employer
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Job</th>
              <th className="th">Location</th>
              <th className="th">Status</th>
              <th className="th">Apply clicks</th>
              <th className="th">Posted</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.items || []).map((j) => {
              const [label, cls] = statusOf(j);
              return (
                <tr key={j._id}>
                  <td className="td">
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-slate-500">
                      {[
                        j.level,
                        j.salary,
                        j.validThrough &&
                          `apply by ${new Date(j.validThrough).toLocaleDateString()}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="td text-sm">
                    {[j.city, j.state].filter(Boolean).join(", ")}
                  </td>
                  <td className="td text-xs">
                    <span className={`badge ${cls}`}>{label}</span>
                    {j.review?.status === "rejected" && j.review.note && (
                      <div className="mt-1 text-red-700">{j.review.note}</div>
                    )}
                  </td>
                  <td className="td">{j.applyClicks || 0}</td>
                  <td className="td text-xs">
                    {new Date(j.createdAt).toLocaleDateString()}
                  </td>
                  <td className="td whitespace-nowrap text-right text-xs">
                    <button
                      type="button"
                      className="mr-3 text-blue-700"
                      onClick={() => edit(j)}
                    >
                      Edit
                    </button>
                    {j.active || j.review?.status === "pending" ? (
                      <button
                        type="button"
                        className="mr-3 text-slate-600"
                        onClick={() =>
                          act(
                            () => api.post(`/employer/jobs/${j._id}/close`),
                            "Close this job? It will stop appearing in searches.",
                          )
                        }
                      >
                        Close
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() =>
                        act(
                          () => api.delete(`/employer/jobs/${j._id}`),
                          "Delete this job permanently?",
                        )
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {data && !data.items.length && (
              <tr>
                <td className="td py-8 text-center text-slate-500" colSpan={6}>
                  You haven’t posted any jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
