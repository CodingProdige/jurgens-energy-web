export const trainedAlgorithmicMediaCode = "trainedAlgorithmicMedia" as const;
export const trainedAlgorithmicMediaUri =
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";

export type MediaDigitalSourceType = typeof trainedAlgorithmicMediaCode;

const iptcExtensionNamespace =
  "http://iptc.org/std/Iptc4xmpExt/2008-02-29/";

export function extractMediaDigitalSourceType(
  xmp: string | null | undefined,
): MediaDigitalSourceType | null {
  if (xmp?.includes(trainedAlgorithmicMediaUri)) {
    return trainedAlgorithmicMediaCode;
  }

  return null;
}

export function updateDigitalSourceTypeXmp(
  _sourceXmp: string | null | undefined,
  digitalSourceType: MediaDigitalSourceType | null,
) {
  if (!digitalSourceType) {
    return null;
  }

  const description = [
    '  <rdf:Description rdf:about=""',
    `    xmlns:Iptc4xmpExt="${iptcExtensionNamespace}">`,
    `    <Iptc4xmpExt:DigitalSourceType rdf:resource="${trainedAlgorithmicMediaUri}"/>`,
    "  </rdf:Description>",
  ].join("\n");

  return [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    description,
    " </rdf:RDF>",
    "</x:xmpmeta>",
    '<?xpacket end="w"?>',
  ].join("\n");
}
