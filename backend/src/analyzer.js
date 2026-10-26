const ignoredWords = new Set([
  'about','above','after','again','against','also','among','and','any','are','because','been','before','being','below','between','both','but','can','could','did','does','doing','down','during','each','few','for','from','further','had','has','have','having','here','hers','him','his','how','into','its','itself','just','more','most','other','our','out','over','own','same','she','should','some','such','than','that','the','their','them','then','there','these','they','this','those','through','under','until','very','was','were','what','when','where','which','while','who','why','will','with','would','you','your','a','an','as','at','by','if','in','is','of','on','or','to','we'
]);

function keywordsFrom(text) {
  return [...new Set((text.toLowerCase().match(/[a-z][a-z+#.-]{1,}/g) || [])
    .map(word => word.replace(/[.#-]+$/g, ''))
    .filter(word => word.length > 2 && !ignoredWords.has(word)))];
}

export function analyzeResume(resumeText, jobRole, jobDescription = '') {
  const targetText = `${jobRole} ${jobDescription}`.trim();
  const targetWords = keywordsFrom(targetText);
  const resumeWords = new Set(keywordsFrom(resumeText));
  const matched = targetWords.filter(word => resumeWords.has(word));
  const missing = targetWords.filter(word => !resumeWords.has(word));
  const score = targetWords.length ? Math.round((matched.length / targetWords.length) * 100) : 0;
  const summary = targetWords.length
    ? `Your resume matches ${matched.length} of ${targetWords.length} keywords found in the role details. Use the missing keywords only where they honestly describe your skills or experience.`
    : 'Add a job description to get a more useful keyword comparison.';
  return { score, matchedKeywords: matched.slice(0, 30), missingKeywords: missing.slice(0, 30), summary };
}
