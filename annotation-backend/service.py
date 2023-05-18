import ast

from bson import ObjectId
from flask import Flask, jsonify, request, Response
from pymongo import MongoClient
from waitress import serve

from util.iou import compute_iou
from util.iou import linear_scale
from util.utility import extract_command_from_request as extract
from bson.json_util import dumps
from flask_cors import CORS

app = Flask(__name__)
app.config['DEBUG'] = True
cors = CORS(app)

client = MongoClient("mongodb://localhost:27017")

cxr_db = client['cxr']  # cxr database

xray_images = cxr_db.xray_images  # xray_images collection



annotation =cxr_db.annotation

disease_scores = cxr_db.disease_scores


# http://localhost:4400/x-ray/images
@app.route("/x-ray/images", methods=["GET"])
def get_random_xray_chest_image():
    """
    Returns a random xray image
    :return: return a random base64-encoded xray chest image
    """
    xray_image = [doc for doc in xray_images.aggregate([{"$sample": {"size": 1}}])][0]
    del xray_image['annotation']
    return Response(dumps(xray_image),
                    mimetype="application/json")


# http://localhost:4400/x-ray/images

@app.route("/x-ray/images", methods=["POST"])
def upload_xray_chest_image():
    command = extract(request, ["image", "annotation", "userId"])

    """
    Returns inserts an x-ray image
    :return: return {"status" : "success"} if it is successful
    """
    xray_images.insert_one(command)
    return jsonify({"status": "success"})

# @app.route("/x-ray/dailyScores", methods=["POST"])
# def store_daily_scores():
#     command=extract(request,["userId","score"])
#     return jsonify({"status": "success"})
#



@app.route("/x-ray/evaluate", methods=["POST"])
def evaluate_annotation():
    """
       Returns inserts an Intersection over Union value
       :return: return {"status" : "success"} if it is successful
    """
    data = request.json
    ground_truth = xray_images.find_one({"_id": ObjectId(data["input_id"])})
    ground_truth_dict = ast.literal_eval(ground_truth["annotation"])
    ground_truth_anomaly = ground_truth_dict["features"][0]["properties"]["anomaly"]

    annotation_dict = ast.literal_eval(data["annotation"])
    annotation_info = {"user_id": data['user_id'], "input_id": data['input_id'],"ground_truth_anomaly":ground_truth_anomaly,
                       "annotation": data["annotation"],"iou_score":0}


    if ground_truth_dict["features"]==[]:
        if annotation_dict["features"]==[]:
            annotation_info["find_disease"] = True
            annotation_info["iou_score"]=1
            annotation.insert_one(annotation_info)
            return jsonify({"status": "success", "iou": "there is no disease and you found it.",
                            "diseaseScore": "NO_DISEASE"})

        elif annotation_dict["features"]!=[]:
            annotation_info["find_disease"] = False
            annotation.insert_one(annotation_info)

            return jsonify({"status": "fail", "iou": "there is no disease you choose a disease.", "diseaseScore": 0,
                            "annotationAnomaly": annotation_dict['features'],
                            "groundTruthAnomaly": ground_truth_anomaly})


    elif ground_truth_dict["features"]!=[]:

        if annotation_dict["features"]==[]:
            annotation_info["find_disease"] = False
            annotation.insert_one(annotation_info)
            return jsonify({"status": "fail", "iou": "there is a disease you choose no disease.", "diseaseScore": 0,
                            "annotationAnomaly": annotation_dict['features'],
                            "groundTruthAnomaly": ground_truth_anomaly})

        elif annotation_dict["features"]!=[]:
            annotation_anomaly = annotation_dict["features"][0]["properties"]["anomaly"]
            print("Ground truth ", ground_truth_anomaly)
            print("Annotated truth ", annotation_anomaly)
            if ground_truth_anomaly == annotation_anomaly:
                find_disease=True
                poly_shape1 = ground_truth_dict["features"][0]['geometry'][
                    "coordinates"]  # picture coordinates
                poly_shape2 = annotation_dict["features"][0]['geometry']["coordinates"]  # annotated part
                print("Ground truth coordinates", poly_shape1[0])
                print("Annotated coordinates", poly_shape2[0])

                result = compute_iou(poly_shape1[0], poly_shape2[0])
                iou_score = linear_scale(result, 0, 1, 0, 10)
                annotation_info["find_disease"] = True
                annotation_info["iou_score"]=iou_score
                annotation.insert_one(annotation_info)

                return jsonify({"status": "success", "iou": result, "diseaseScore": iou_score,
                                "annotationAnomaly": annotation_anomaly,
                                "groundTruthAnomaly": ground_truth_anomaly})

            elif ground_truth_anomaly != annotation_anomaly:
                print("Ground truth coordinates", ground_truth_dict["features"][0]['geometry'][
                    "coordinates"][0])
                print("Annotated coordinates", annotation_dict["features"][0]['geometry']["coordinates"][0])
                annotation_info["find_disease"] =False
                annotation.insert_one(annotation_info)
                return jsonify({"status": "fail", "iou": "you choose different disease", "diseaseScore": 0,
                                "annotationAnomaly": annotation_anomaly,
                                "groundTruthAnomaly": ground_truth_anomaly})






if __name__ == "__main__":
    print("Server is running...")
    serve(app, host="localhost", port=4400)