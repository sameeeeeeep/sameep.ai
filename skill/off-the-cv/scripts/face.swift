// face.swift <photo> <mask-out.png>: person cut-out mask + face landmarks, on-device (Apple Vision).
// Prints JSON: {"w":W,"h":H,"face":[x,y,w,h],"mouth":[x,y,w],"eyes":[[x,y],[x,y]]} in pixels, top-left origin.
// Run with: swift face.swift photo.jpg mask.png   (macOS 12+; nothing leaves the Mac)
import AppKit
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 3, let img = NSImage(contentsOfFile: args[1]),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("usage: swift face.swift <photo> <mask.png>\n".data(using: .utf8)!); exit(2)
}
let W = CGFloat(cg.width), H = CGFloat(cg.height)
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
let seg = VNGeneratePersonSegmentationRequest(); seg.qualityLevel = .accurate; seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
let lm = VNDetectFaceLandmarksRequest()
try handler.perform([seg, lm])

if let buf = seg.results?.first?.pixelBuffer {
  let ci = CIImage(cvPixelBuffer: buf).transformed(by: CGAffineTransform(scaleX: W / CGFloat(CVPixelBufferGetWidth(buf)), y: H / CGFloat(CVPixelBufferGetHeight(buf))))
  let ctx = CIContext()
  if let out = ctx.createCGImage(ci, from: CGRect(x: 0, y: 0, width: W, height: H)) {
    let rep = NSBitmapImageRep(cgImage: out)
    try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
  }
}
var res: [String: Any] = ["w": Int(W), "h": Int(H)]
if let f = (lm.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
  let bb = f.boundingBox
  let fx = bb.minX * W, fy = (1 - bb.maxY) * H, fw = bb.width * W, fh = bb.height * H
  res["face"] = [fx, fy, fw, fh].map { Int($0) }
  func pts(_ r: VNFaceLandmarkRegion2D?) -> [CGPoint] {
    (r?.normalizedPoints ?? []).map { CGPoint(x: fx + $0.x * fw, y: fy + (1 - $0.y) * fh) }
  }
  func mid(_ p: [CGPoint]) -> [Int]? {
    guard !p.isEmpty else { return nil }
    return [Int(p.map(\.x).reduce(0, +) / CGFloat(p.count)), Int(p.map(\.y).reduce(0, +) / CGFloat(p.count))]
  }
  let lips = pts(f.landmarks?.outerLips)
  if let m = mid(lips) { res["mouth"] = m + [Int((lips.map(\.x).max() ?? 0) - (lips.map(\.x).min() ?? 0))] }
  if let l = mid(pts(f.landmarks?.leftEye)), let r = mid(pts(f.landmarks?.rightEye)) { res["eyes"] = [l, r] }
}
print(String(data: try JSONSerialization.data(withJSONObject: res), encoding: .utf8)!)
