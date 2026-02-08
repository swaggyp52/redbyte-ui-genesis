import basys3MvpLab from '../../../../labs/basys3_mvp_lab/lab.json';
const LAB_TEMPLATES = {
    [basys3MvpLab.lab_id]: basys3MvpLab,
};
export function getLabTemplate(labId) {
    return LAB_TEMPLATES[labId] ?? null;
}
