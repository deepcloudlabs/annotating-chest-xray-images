import os
import base64
import pandas as pd
import pymongo
from pydicom import dcmread
from PIL import Image
import pylibjpeg
import csv

from flask import Flask, jsonify, request, Response
from pymongo import MongoClient
from waitress import serve
from flask_cors import CORS


app = Flask(__name__)
app.config['DEBUG'] = True
cors = CORS(app)

client = MongoClient("mongodb://localhost:27017")

cxr_db = client['cxr']  # cxr database

png_xray_images=cxr_db.png_xray_images

def find_classes():
    csv_file = r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\util\train.csv"
    dicom_folder_path=r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\dicomToPng\dicomImages\New"
    for filename in os.listdir(dicom_folder_path):
        dicom_file_path = os.path.join(dicom_folder_path, filename)
        name = os.path.splitext(filename)[0]
        with open(csv_file, 'r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                print(row['class_id'])


def find_information(value):
    csv_file=r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\util\train.csv"
    column_name="image_id"
    selected_rows=[]
    with open(csv_file,'r') as file:
        reader=csv.DictReader(file)
        for row in reader:
            if row[column_name]==value:
                del row['image_id']
                selected_rows.append(row)

    return selected_rows


def convert_dicom_to_jpg():
    dicom_folder_path=r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\dicomToPng\dicomImages\New"
    output_folder_path=r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\dicomToPng\pngImages"

    image_information=[]
    for filename in os.listdir(dicom_folder_path):
        dicom_file_path = os.path.join(dicom_folder_path, filename)

        if filename.endswith("dicom"):
            name = os.path.splitext(filename)[0]
            data=find_information(name)
            # Read DICOM file
            dicom=dcmread(dicom_file_path)

            # Convert DICOM to PNG
            image=dicom.pixel_array
            image=Image.fromarray(image)

            output_file_path = os.path.join(output_folder_path, os.path.splitext(filename)[0] + ".png")
            image.save(output_file_path)

            with open(output_file_path,"rb") as file:
                encoded_image=base64.b64encode(file.read())

            image_dict={
                "filename":name,
                "image":encoded_image,
                "data":data
            }
            png_xray_images.insert_one(image_dict)
            print()
            image_information.append(image_dict)

    return image_information



convert_dicom_to_jpg()