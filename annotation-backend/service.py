from shapely.geometry import Polygon
import ast
from flask import Flask, jsonify, request, Response
from pymongo import MongoClient
from waitress import serve
from util.utility import extract_command_from_request as extract
from bson.json_util import dumps
from flask_cors import CORS

app = Flask(__name__)
app.config['DEBUG'] = True
cors = CORS(app)

client = MongoClient("mongodb://localhost:27017")

cxr_db = client['cxr']  # cxr database

xray_images = cxr_db.xray_images  # xray_images collection


# http://localhost:4400/x-ray/images
@app.route("/x-ray/images", methods=["GET"])
def get_random_xray_chest_image():
    """
    Returns a random xray image
    :return: return a random base64-encoded xray chest image
    """
    return Response(dumps([img for img in xray_images.aggregate([{"$sample": {"size": 1}}])][0]),
                    mimetype="application/json")


# http://localhost:4400/x-ray/images

@app.route("/x-ray/images", methods=["POST"])
def upload_xray_chest_image():
    command = extract(request, ["image", "annotation", "type", "features", "coordinates", "geometry", "properties"])
    """
    Returns inserts an x-ray image
    :return: return {"status" : "success"} if it is successful
    """
    xray_images.insert_one(command)
    return jsonify({"status": "success"}) \
 \
 \

@app.route("/x-ray/evaluate", methods=["POST"])
def evaluate_annotation():
    """
    Returns inserts an Intersection over Union value
    :return: return {"status" : "success"} if it is successful
    """
    # print(request.json)
    data = request.json

    annotation_dict = ast.literal_eval(data["annotation"])
    print(annotation_dict["features"])


    anomaly0=annotation_dict["features"][0]["properties"]["anomaly"]
    anomaly1=annotation_dict["features"][1]["properties"]["anomaly"]

    if anomaly0==anomaly1:
        poly_shape1=annotation_dict["features"][0]['geometry']["coordinates"] #picture coordinates
        poly_shape2=annotation_dict["features"][1]['geometry']["coordinates"] #annotated part
        print("Anomaly coordinates",poly_shape1[0])
        print("Annotated coordinates",poly_shape2[0])


        result= get_iou(poly_shape1[0], poly_shape2[0])
        print('IoU is',result)


        return jsonify({"status": "success","iou":result})

    return jsonify({"status": "unsuccess", "iou": "could not be calculated"})


def get_iou(poly_shape1, poly_shape2):
    shape1 = Polygon(poly_shape1)
    shape2 = Polygon(poly_shape2)

    polygon_intersection = shape1.intersection(shape2).area
    polygon_union = shape1.area + shape2.area - polygon_intersection
    return polygon_intersection / polygon_union


if __name__ == "__main__":
    print("Server is running...")
    serve(app, host="localhost", port=4400)
