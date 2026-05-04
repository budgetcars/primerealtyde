import type { XmlPathSample } from './genericXmlMap';

export type XmlPathTreeNode = {
	segment: string;
	leaf: XmlPathSample | null;
	children: XmlPathTreeNode[];
};

/** Baut verschachtelte Knoten wie bei WP-/ACF-Repeatern (Pfadsegmente klappbar). */
export function buildXmlPathTree(samples: XmlPathSample[]): XmlPathTreeNode[] {
	function findOrCreateChild(nodes: XmlPathTreeNode[], segment: string): XmlPathTreeNode {
		let n = nodes.find((x) => x.segment === segment);
		if (!n) {
			n = { segment, leaf: null, children: [] };
			nodes.push(n);
		}
		return n;
	}

	const rootNodes: XmlPathTreeNode[] = [];

	for (const sample of samples) {
		const parts = sample.path.split('/').filter(Boolean);
		let level = rootNodes;

		for (let i = 0; i < parts.length; i++) {
			const seg = parts[i]!;
			const row = findOrCreateChild(level, seg);
			if (i === parts.length - 1) row.leaf = sample;
			level = row.children;
		}
	}

	function sortRecursive(nodes: XmlPathTreeNode[]) {
		nodes.sort((a, b) => {
			const ai = /\[\d+\]/.test(a.segment) ? 1 : 0;
			const bi = /\[\d+\]/.test(b.segment) ? 1 : 0;
			if (ai !== bi) return ai - bi;
			return a.segment.localeCompare(b.segment, 'de', { numeric: true });
		});
		for (const n of nodes) sortRecursive(n.children);
	}

	sortRecursive(rootNodes);
	return rootNodes;
}
