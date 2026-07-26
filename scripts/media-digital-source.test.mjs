import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  extractMediaDigitalSourceType,
  trainedAlgorithmicMediaCode,
  trainedAlgorithmicMediaUri,
  updateDigitalSourceTypeXmp,
} from "../src/modules/media/digital-source.ts";

test("embeds trained algorithmic media metadata in an optimized WebP", async () => {
  const source = await sharp({
    create: {
      background: "#ff5a1f",
      channels: 4,
      height: 32,
      width: 32,
    },
  })
    .png()
    .toBuffer();
  const xmp = updateDigitalSourceTypeXmp(
    null,
    trainedAlgorithmicMediaCode,
  );

  assert.ok(xmp);

  const output = await sharp(source)
    .webp({ quality: 78 })
    .withXmp(xmp)
    .toBuffer();
  const metadata = await sharp(output).metadata();

  assert.equal(
    extractMediaDigitalSourceType(metadata.xmpAsString),
    trainedAlgorithmicMediaCode,
  );
  assert.match(metadata.xmpAsString ?? "", /Iptc4xmpExt:DigitalSourceType/);
  assert.match(metadata.xmpAsString ?? "", new RegExp(trainedAlgorithmicMediaUri));
});

test("detects alternate XMP prefixes and writes one canonical AI source tag", () => {
  const sourceXmp = [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '  <rdf:Description rdf:about="" xmlns:custom="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">',
    `   <custom:DigitalSourceType rdf:resource="${trainedAlgorithmicMediaUri}"/>`,
    "   <custom:PrivateField>do not retain</custom:PrivateField>",
    "  </rdf:Description>",
    " </rdf:RDF>",
    "</x:xmpmeta>",
    '<?xpacket end="w"?>',
  ].join("\n");

  assert.equal(
    extractMediaDigitalSourceType(sourceXmp),
    trainedAlgorithmicMediaCode,
  );

  const tagged = updateDigitalSourceTypeXmp(
    sourceXmp,
    trainedAlgorithmicMediaCode,
  );

  assert.ok(tagged);
  assert.match(tagged, new RegExp(trainedAlgorithmicMediaUri));
  assert.equal(
    tagged.match(new RegExp(trainedAlgorithmicMediaUri, "g"))?.length,
    1,
  );
  assert.doesNotMatch(tagged, /PrivateField/);

  const untagged = updateDigitalSourceTypeXmp(tagged, null);

  assert.equal(untagged, null);
  assert.equal(extractMediaDigitalSourceType(untagged), null);
});
