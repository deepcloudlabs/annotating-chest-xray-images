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

annotation_information=cxr_db.annotation_information

daily_scores=cxr_db.daily_scores

disease_scores=cxr_db.disease_scores


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

@app.route("/x-ray/dailyScores", methods=["POST"])
def store_daily_scores():
    command=extract(request,["userId","score"])
    daily_scores.insert_one(command)
    return jsonify({"status": "success"})

@app.route("/x-ray/diseaseScores", methods=["POST"])
def store_disease_based_scores():
    command=extract(request,["userId","annotation","diseaseScore"])
    disease_scores.insert_one(command)

    return jsonify({"status": "success"})


@app.route("/x-ray/evaluate", methods=["POST"])
def evaluate_annotation():
    """
       Returns inserts an Intersection over Union value
       :return: return {"status" : "success"} if it is successful
    """
    data = request.json
    annotation_dict = ast.literal_eval(data["annotation"])
    # print("annotation_dict",annotation_dict['features'])
    ground_truth = xray_images.find_one({"_id": ObjectId(data["input_id"])})
    ground_truth_annotation_dict = ast.literal_eval(ground_truth["annotation"])
    # print("ground_truth_annotation_dict", ground_truth_annotation_dict['features'])
    ground_truth_anomaly = ground_truth_annotation_dict["features"][0]["properties"]["anomaly"]

    annotation_info = {"user_id": data['user_id'], "input_id": data['input_id'],
                       "annotation": data["annotation"]}
    annotation_information.insert_one(annotation_info)

    if ground_truth_annotation_dict['features']==[] and annotation_dict['features']==[]:
        return jsonify({"status": "success", "iou": "there is no disease and you found it.",
                        "diseaseScore": "NO_DISEASE"})

    elif ground_truth_annotation_dict['features']!=[] and annotation_dict['features']==[]:

        return jsonify({"status": "fail", "iou": "there is a disease you choose no disease.", "diseaseScore": 0,
                        "annotationAnomaly": annotation_dict['features'],
                        "groundTruthAnomaly": ground_truth_anomaly})

    elif ground_truth_annotation_dict['features']==[] and annotation_dict['features'] != 'NO_DISEASE':

        return jsonify({"status": "fail", "iou": "there is no disease you choose a disease.", "diseaseScore": 0,
                        "annotationAnomaly": annotation_dict['features'],
                        "groundTruthAnomaly": ground_truth_anomaly})


    else:
        annotation_anomaly = annotation_dict["features"][0]["properties"]["anomaly"]
        print("Ground truth ", ground_truth_anomaly)
        print("Annotated truth ", annotation_anomaly)


        if ground_truth_anomaly == annotation_anomaly:

            poly_shape1 = ground_truth_annotation_dict["features"][0]['geometry']["coordinates"]  # picture coordinates
            poly_shape2 = annotation_dict["features"][0]['geometry']["coordinates"]  # annotated part
            print("Ground truth coordinates", poly_shape1[0])
            print("Annotated coordinates", poly_shape2[0])

            result = compute_iou(poly_shape1[0], poly_shape2[0])
            iou_score = linear_scale(result, 0, 1, 0, 10)

            return jsonify({"status": "success", "iou": result, "diseaseScore": iou_score,
                            "annotationAnomaly":annotation_anomaly,
                            "groundTruthAnomaly":ground_truth_anomaly})

        elif ground_truth_anomaly != annotation_anomaly:

            return jsonify({"status": "fail", "iou": "you choose different disease", "diseaseScore":0,
                            "annotationAnomaly":annotation_anomaly,
                            "groundTruthAnomaly":ground_truth_anomaly})


if __name__ == "__main__":
    print("Server is running...")
    serve(app, host="localhost", port=4400)